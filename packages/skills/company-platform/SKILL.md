---
name: company-platform
description: |
  Arquitectura hexagonal + DDD para construir aplicaciones sobre los paquetes de este monorepo
  (@platform/core, /infrastructure, /adapter-aws, /adapter-node).
  Define la estructura src/apps, src/core/{application,domain}, src/infrastructure/{deployment,clients,persistence,env.ts},
  src/shared e src/index.ts; la dirección de dependencias (deployment → apps → application → domain);
  y cuándo sí/no crear abstracciones (composición manual por defecto, sin contenedores de DI ni magia oculta).

  Usar cuando el usuario: crea una app o servicio nuevo sobre estos paquetes, decide dónde ubicar un
  caso de uso, entidad, repositorio o adaptador, estructura las carpetas de un proyecto backend nuevo,
  pregunta cómo instalar/consumir core, infrastructure o los adapters de este monorepo, o pide revisar
  si un módulo respeta la separación domain/application/infrastructure.
metadata:
  version: 1.6.0
---

# Company Platform — Arquitectura de aplicaciones

Guía para construir aplicaciones sobre los paquetes de este monorepo. No es un framework: es una
convención de carpetas + un conjunto de reglas de dependencia, pensada para que la lógica de negocio
quede desacoplada de cualquier proveedor de infraestructura.

## Filosofía

> **Más explícito, menos magia oculta.**

- DDD + Arquitectura Hexagonal, adaptados a la realidad del proyecto — sin abstracciones "por si acaso".
- Una interfaz/abstracción solo se crea cuando hay una necesidad concreta: múltiples implementaciones,
  desacoplar infraestructura de negocio, o reducir acoplamiento real. Nunca especulativamente.
- **Composición sobre herencia.** Nada de reflexión, decoradores o descubrimiento automático de
  componentes (`@Injectable`, escaneo de directorios, etc.). El flujo de ejecución se sigue leyendo el código.
- **Composición manual por defecto.** Un contenedor de inyección de dependencias solo se evalúa cuando
  el costo de mantener el cableado manual supera la complejidad que añadiría el contenedor — no antes.
- Una estructura predecible reduce el contexto que un asistente de IA necesita para ubicar
  responsabilidades, generar código y proponer refactors con precisión.

## Instalación (sin registro de publicación)

Estos paquetes no se publican a ningún registro todavía. La única vía de instalación es clonar este
repositorio y copiar lo que el proyecto consumidor necesita:

1. Clona `platform` en una ruta accesible desde tu proyecto.
2. Copia los paquetes que necesites dentro de tu propio repo:
   - `packages/core` — siempre necesario (dominio + aplicación compartidos).
   - `packages/infrastructure` — siempre necesario (HTTP, `RestClient`, `EventBus`, errores).
   - `packages/env` — recomendado para todo proyecto (carga/valida `process.env` para `infrastructure/env.ts`, ver más abajo). Sin dependencias de terceros por defecto; intercambiable por zod/valibot/arktype sin tocar el resto del proyecto.
   - `packages/adapters/aws` — solo si el deployment target es AWS Lambda / API Gateway.
   - `packages/adapters/node` — solo si el deployment target es un servidor HTTP local/Node.
   - `packages/adapters/redis` — solo si el proyecto necesita cachear respuestas HTTP en Redis
     (`RedisHttpResponseCache`, ver tabla de primitivas HTTP más abajo).
   - `packages/testing` — recomendado como `devDependency` (`InMemoryRepository`, `FakeLogger`,
     `buildHttpRequest`, `InMemoryEventBus` — ver [`@platform/testing`](#platformtesting)).
3. Referéncialos como dependencias:
   - Si tu proyecto ya es un workspace pnpm: coloca las carpetas copiadas bajo tu propio `packages/` y
     usa `"@platform/core": "workspace:*"` (idem para el resto).
   - Si es un proyecto standalone: usa el protocolo `file:` apuntando a la ruta local del clon, p. ej.
     `"@platform/core": "file:../platform/packages/core"`.
4. Corre `tsc` (`turbo run build` si tu proyecto también usa Turborepo) para generar `dist/` antes de consumirlos —
   cada paquete se resuelve vía su `main`/`exports` apuntando a `dist/index.js`.

No vendorees el código fuente editándolo dentro de tu proyecto: si necesitas un cambio en `core` o
`infrastructure`, hazlo en el paquete original y vuelve a copiarlo — mantener un fork silencioso rompe
la trazabilidad de cambios entre proyectos.

## Estructura de carpetas

```
src
├── apps
├── core
│   ├── application
│   └── domain
├── infrastructure
│   ├── deployment
│   │   ├── aws
│   │   └── local
│   ├── clients
│   ├── persistence
│   └── env.ts
├── shared
└── index.ts
```

### Dirección de dependencias

```
deployment
      ↓
apps
      ↓
application
      ↓
domain
```

La infraestructura **nunca** contiene reglas de negocio. Las flechas solo van hacia el núcleo: `domain`
no importa nada de `application`, `application` no importa nada de `infrastructure`/`apps`, etc.

## Jerarquía de errores

Todos los errores de `@platform/core` e `/infrastructure` (`packages/core/src/platform`)
comparten una raíz común, `StructuredError extends Error` (`type`, `origin?`, `cause`, `toScalars()`),
que se bifurca en dos ramas con propósitos distintos:

```
                         StructuredError
                    ↙                     ↘
           PlatformError              ExtensibleError
     (errores DE estas               (punto de extensión
      librerías — no                  PÚBLICO — tus errores
      extender desde tu               van acá)
      proyecto)                    ↙        ↓         ↘
           ↓              ApplicationError  DomainError  HttpError
       AdapterError            ↓                ↓           ↓
    (adapter-aws/node,   tus errores de    tus errores    tus errores
     ver más abajo)       aplicación        de dominio       HTTP
```

- **`PlatformError`** es exclusiva de estas librerías: la usan internamente para señalar que un error
  vino del propio framework (p. ej. `AdapterError`, extendida por `MalformedApiGatewayEventError`,
  `MalformedHttpRequestError`, `HttpServerListenError`, `HttpServerCloseError`, `HttpRequestStreamError`
  — ver `deployment/aws` y `deployment/local` más abajo). **Nunca extiendas `PlatformError` ni
  `AdapterError` desde el código de tu proyecto** — no son tu punto de extensión, y hacerlo rompe la
  garantía de que `err instanceof PlatformError` significa "esto vino de la librería, no de mi app".
- **`ExtensibleError`** es el punto de extensión público. `ApplicationError`, `DomainError` (`core`) y
  `HttpError` (`infrastructure`) ya extienden de aquí — y cada uno trae errores por defecto listos para
  usar (ver tablas de `core/application`, `core/domain` e `infrastructure` más abajo). Cuando el
  proyecto necesita un error propio, siempre se extiende uno de estos tres, nunca `StructuredError` ni
  `ExtensibleError` directamente:

```ts
// core/application/OrderAlreadyShippedError.ts
import { ApplicationError } from "@platform/core";

export class OrderAlreadyShippedError extends ApplicationError {
  type = "OrderAlreadyShippedError";
  constructor(readonly orderId: string) {
    super(`Order ${orderId} was already shipped`);
  }
}
```

Como todos comparten `toScalars()`, cualquier error (de la librería o del proyecto) se serializa igual
para logging: `{ type, origin?, description, data }`, donde `data` refleja automáticamente las
propiedades propias que declares en el constructor (`readonly orderId` del ejemplo de arriba aparece
solo en `data` sin armarlo a mano).

## `apps/`

Puntos de entrada propios de la aplicación. Adaptan una interacción externa (HTTP, evento, comando,
proceso programado) a un caso de uso del dominio. **No** contienen reglas de negocio ni dependencias
específicas de infraestructura (nada de SDKs de AWS, drivers de base de datos, etc. — eso vive en
`infrastructure/deployment`).

```
src/apps
├── CreateOrderController.ts
├── OrderCreatedListener.ts
└── ...
```

Un controller típico usa `HttpRequestMapper`/`createHttpDispatcher` de
`@platform/infrastructure` para traducir la request ya mapeada a la llamada
del caso de uso, y traduce el `ApplicationResult` que devuelve con `toHttpResponse` (ver
[`UseCase` y `ApplicationResult`](#usecase-y-applicationresult-el-estándar-de-respuesta-de-application) y la
tabla de primitivas HTTP más abajo). Si el endpoint recibe body/query/path params, se validan al
entrar con `parseJsonBody`/`parseQueryParams`/`parsePathParams` (`@platform/infrastructure`) antes de
llamar al caso de uso — esos sí lanzan (`BadRequestError`/`UnprocessableEntityError`), porque ocurren
antes de llegar al caso de uso y el dispatcher los captura igual que siempre:

```ts
// apps/CreateOrderController.ts
import { parseJsonBody, toHttpResponse, type HttpRequest, type HttpResponse } from "@platform/infrastructure";
import { z } from "zod";
import { CreateOrder } from "../core/application/CreateOrder.js";

const CreateOrderBody = z.object({ customerId: z.string(), items: z.array(z.string()).min(1) });

export class CreateOrderController {
  constructor(private readonly createOrder: CreateOrder) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const body = parseJsonBody(request, CreateOrderBody); // 400 si no es JSON, 422 si no matchea
    const result = await this.createOrder.execute(body);
    return toHttpResponse(result, { successStatusCode: 201 });
  }
}
```

## `core/`

El corazón de la aplicación. **No puede depender de tecnologías externas** (sin SDKs, sin drivers, sin
`fetch`/`http` directo). Se divide en dos capas.

### `core/application/`

Implementa los casos de uso y orquesta el flujo. **No** contiene reglas de negocio — eso es `domain`.
Las abstracciones (interfaces de repositorios, clientes, etc.) solo aparecen aquí cuando hay una
necesidad real de desacoplamiento (p. ej. necesitas poder testear el caso de uso sin pegarle a
DynamoDB, o vas a tener más de una implementación).

`@platform/core` ya trae un ejemplo real de este patrón:
`Logger` (`packages/core/src/application/Logger.ts`) es una clase abstracta —no una interfaz— que vive en
`application` porque los casos de uso dependen de ella (`constructor(orderRepository, private readonly
logger: Logger)`), pero cada entorno de despliegue inyecta su propia implementación concreta
(`NodeConsoleLoggerClient`, `AWSLoggerClient` — ver `infrastructure/deployment/*` más abajo). `Logger`
enmascara automáticamente campos sensibles (`password`, `token`, `secret`, `authorization`, `apikey`,
`accesstoken`, `refreshtoken`, `creditcard`, `cvv`, `pin`, más los que se pasen en el constructor) antes
de loguear: las subclases implementan `info/error/warn/debug` y deben pasar el contexto por
`this.mask(context)` — nunca loguear el `context` crudo.

### `UseCase` y `ApplicationResult`: el estándar de respuesta de `application/`

Todo caso de uso implementa `UseCase<TCommand, TData>` (`packages/core/src/application/UseCase.ts`) y
devuelve un `ApplicationResult<TData>` en vez de lanzar sus errores de negocio esperados —
`execute()` los captura y los traduce con `toApplicationFailure`. Solo debería escapar como excepción
sin capturar algo que el propio caso de uso no anticipó (un bug real).

| Export | Firma real | Uso típico |
| --- | --- | --- |
| `ApplicationResult<T>` | `{ ok: true, data: T } \| { ok: false, error: { type, origin?, message, data? } }`. | Tipo de retorno de todo `UseCase.execute`. |
| `toApplicationSuccess(data)` | `<T>(data: T) => ApplicationResultSuccess<T>`. | Construir el resultado exitoso de un caso de uso. |
| `toApplicationFailure(err)` | `(err: unknown) => ApplicationResultError`. Si `err` es un `ApplicationError` (o subclase de `DomainError`/`HttpError`, cualquier `ExtensibleError`), reutiliza su `toScalars()` — mismo `type`/`origin`/campos propios que el resto de la jerarquía de errores (ver [Jerarquía de errores](#jerarquía-de-errores)). Cualquier otro `unknown` se envuelve primero en `UnexpectedError`. | Capturar dentro de `execute()` cualquier error, de negocio o inesperado, antes de devolverlo. |
| `UseCase<TCommand, TData>` | `interface { execute(command: TCommand): Promise<ApplicationResult<TData>> }`. | Contrato que implementa cada caso de uso de `core/application`. |

```ts
// core/application/CreateOrder.ts
import { UseCase, ApplicationResult, toApplicationSuccess, toApplicationFailure } from "@platform/core";

export class CreateOrder implements UseCase<CreateOrderCommand, Order> {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly logger: Logger,
  ) {}

  async execute(command: CreateOrderCommand): Promise<ApplicationResult<Order>> {
    try {
      const order = Order.create(command);
      await this.orderRepository.save(order);
      return toApplicationSuccess(order);
    } catch (err) {
      this.logger.error("CreateOrder failed", { err });
      return toApplicationFailure(err);
    }
  }
}
```

El controller en `apps/` traduce el `ApplicationResult` a `HttpResponse` con `toHttpResponse`
(`@platform/infrastructure`) — ver ejemplo en [`apps/`](#apps) y la tabla de primitivas HTTP más abajo.

#### Inventario de errores de aplicación (`packages/core/src/application`)

`ApplicationError` (ver [Jerarquía de errores](#jerarquía-de-errores)) trae 6 errores por defecto,
todos con `origin = '@platform/core'` y un `cause?: unknown` opcional en el
constructor para no perder la traza del error original:

| Clase                      | Firma real                                                                                                                                                                             | Mapeo HTTP (`toHttpError`)                                                                 | Uso típico                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `NotFoundError`            | `constructor(message = 'Not found', cause?)`. Sin código HTTP propio — homónimo del `NotFoundError` de `infrastructure`; alias si se usan ambos: `NotFoundError as CoreNotFoundError`. | `NotFoundError` (404)                                                                      | Un caso de uso busca una entidad y no la encuentra.                                                                      |
| `ValidationError`          | `constructor(message = 'Validation failed', cause?)`.                                                                                                                                  | `UnprocessableEntityError` (422)                                                           | Falla una validación de negocio a nivel de caso de uso (para VOs individuales, usar `InvalidArgumentError` de `domain`). |
| `UpstreamTimeoutError`     | `constructor(message = 'Upstream timeout', cause?)`. Ya la lanza `NodeFetchRestClient` cuando expira `AbortSignal.timeout`.                                                            | `GatewayTimeoutError` (504)                                                                | Un sistema externo no respondió a tiempo.                                                                                |
| `UpstreamServiceError`     | `constructor(message = 'Upstream error', cause?)`. Ya la lanza `NodeFetchRestClient` en errores de red, respuestas no-2xx, y también si un 2xx trae un body no-JSON.                   | `BadGatewayError` (502)                                                                    | Un sistema externo respondió con error o algo inconsumible.                                                              |
| `IntegrationMismatchError` | `constructor(message = 'Integration mismatch', cause?)`.                                                                                                                               | `BadGatewayError` (502)                                                                    | El contrato de un sistema externo cambió de forma inesperada.                                                            |
| `UnexpectedError`          | `constructor(message = 'Unexpected error', cause?)`.                                                                                                                                   | Sin mapeo explícito — cae en el fallback `InternalServerError('Unexpected server error')`. | Punto de escape para errores realmente inesperados dentro de un caso de uso.                                             |

Para errores de negocio más específicos del proyecto, extender `ApplicationError` directo (ver ejemplo
en [Jerarquía de errores](#jerarquía-de-errores)) en vez de forzar alguno de estos seis a un caso que no
encaja.

### `core/domain/`

Entidades, agregados, objetos de valor, servicios de dominio, eventos y reglas de negocio. Debe
permanecer completamente independiente de cualquier tecnología. Aquí es donde encajan las primitivas de
`@platform/core` (`AggregateRoot`, `ValueObject`, `EnumValueObject`,
`PatternValueObject`, `DateValueObject`, `Uuid`, `DomainEvent`, `DomainEventSubscriber`, `DomainError`).

#### Inventario de primitivas de dominio (`packages/core/src/domain`)

| Clase                             | Firma real                                                                                                                                                                                                                                                                                                                                     | Uso típico                                                                                                                                                                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ValueObject<T>`                  | `abstract class ValueObject<T extends string\|number\|boolean\|Date>`; `constructor(readonly value: T)` valida que `value` no sea `null`/`undefined` (lanza `InvalidArgumentError`); expone `equals(other)` y `toString()`.                                                                                                                    | Base de cualquier VO simple: `class Email extends ValueObject<string> { constructor(v: string) { super(v); /* tu propia validación */ } }`.                                                                                                   |
| `EnumValueObject<T>`              | `constructor(value: T, validValues: readonly T[])`; `protected throwErrorForInvalidValue(value: T): void` ya tiene una implementación por defecto (lanza `InvalidArgumentError`) — solo hace falta sobreescribirla si el VO necesita un error más específico.                                                                                  | VOs de tipo "estado"/"categoría" con un set cerrado de valores válidos (p. ej. `OrderStatus`).                                                                                                                                                |
| `PatternValueObject`              | `constructor(value: string, patterns: readonly RegExp[], validValues: readonly string[] = [])`; valida por regex o por match exacto contra `validValues`; mismo `throwErrorForInvalidValue` con default, override opcional.                                                                                                                    | VOs de formato (emails, códigos, IDs con patrón) que no son un enum cerrado.                                                                                                                                                                  |
| `DateValueObject`                 | `abstract class DateValueObject extends ValueObject<Date>`; agrega `isBefore`, `isAfter`, `isFuture`, `isPast`. No añade validación propia.                                                                                                                                                                                                    | Fechas de dominio (`DueDate`, `OccurredOn`) donde importa comparar, no solo envolver un `Date`.                                                                                                                                               |
| `Uuid<T extends string = string>` | `constructor(value: T)` valida formato **UUID v4 estricto** (el regex exige el nibble de versión `4` y el bit de variante `[89AB]`); `static random()` genera uno con `crypto.randomUUID()`.                                                                                                                                                   | Identificadores de agregado: `class OrderId extends Uuid {}`. Si el proyecto usa ULID u otro esquema de ID, `Uuid` no sirve de base — hay que extender `ValueObject<string>` directo.                                                         |
| `AggregateRoot<TScalar = unknown>` | `protected constructor()` (solo instanciable desde una subclase); `record(event: DomainEvent)` acumula eventos; `pullDomainEvents()` los vacía y devuelve una copia; `abstract toScalar(): TScalar`.                                                                                                                                           | El caso de uso en `application/` hace `entity.record(new SomethingHappened(...))` dentro del método de dominio, y tras persistir llama `entity.pullDomainEvents()` para publicarlos (vía [`EventBus`](#eventbus)). `class Order extends AggregateRoot<OrderScalars> { toScalar(): OrderScalars { ... } }` — el `TScalar` explícito le da tipo a lo que devuelve `toScalar()` en vez de `unknown`/`any`. |
| `DomainEvent<TAttributes = Record<string, unknown>>` | `protected constructor(eventName, aggregateId, eventId?, occurredOn?)` — autogenera `eventId` (`Uuid.random()`) y `occurredOn` (`new Date()`) si no se pasan; cada subclase define el `static EVENT_NAME`, el `static fromScalars(...)` (para reconstruir el evento desde un stream/broker) y el método de instancia `toScalars(): TAttributes`. `EVENT_NAME`/`fromScalars` quedan fuera del genérico porque TypeScript no permite que un miembro `static` referencie el parámetro de tipo de su propia clase. | `class OrderCreated extends DomainEvent<{ orderId: string }> { static EVENT_NAME = 'order.created'; toScalars() { return { orderId: this.aggregateId }; } }` — `toScalars()` queda tipado en vez de devolver `Record<string, unknown>` a ciegas. |
| `DomainEventSubscriber<T>`        | Interfaz: `subscribedTo(): DomainEventClass[]` + `on(event: T): Promise<void> \| void`.                                                                                                                                                                                                                                                        | La implementan los listeners que viven en `apps/` (p. ej. `OrderCreatedListener.ts`), registrados contra el [`EventBus`](#eventbus) del proyecto.                                                                                                          |
| `DomainError`                     | `abstract class DomainError extends ExtensibleError` (ver [Jerarquía de errores](#jerarquía-de-errores)) con `abstract type: string`; hereda `toScalars()` de `StructuredError`, que serializa `{ type, origin?, description, data }` **reflejando automáticamente** las propiedades propias del error (excluye `type`, `origin` y `message`). | Por eso el patrón correcto es declarar las propiedades adicionales del error como `readonly` en el constructor (`constructor(readonly orderId: string) { super(...) }`) — `toScalars()` las recoge solo sin necesidad de armar `data` a mano. |
| `InvalidArgumentError`            | Implementación concreta de `DomainError` (`type = 'InvalidArgumentError'`), ya usada internamente por `ValueObject` y `Uuid`.                                                                                                                                                                                                                  | Reutilizable directo para validaciones simples; para errores de negocio más específicos, extender `DomainError` en el propio `domain/` del proyecto.                                                                                          |
| `UnreachableCaseError`            | Implementación concreta de `DomainError` (`type = 'UnreachableCaseError'`); `constructor(value: never)` — mensaje incluye el valor recibido serializado.                                                                                                                                                                                       | Es lo que lanza `assertNever` (fila de abajo) en runtime; no se instancia a mano.                                                                                                                                                             |
| `assertNever(x: never)`           | Lanza `UnreachableCaseError` si se invoca en runtime — algo que TypeScript debería impedir en compilación.                                                                                                                                                                                                                                     | Exhaustividad en `switch` sobre uniones discriminadas (VOs de tipo enum, eventos de dominio, etc.) — si se agrega un caso nuevo sin manejarlo, TypeScript marca error en el `default: assertNever(x)`.                                        |

Dependencia interna:

```
application
      ↓
domain
```

Ejemplo:

```
src/core
├── application
│   └── OrderCreator.ts
└── domain
    └── Order.ts
```

> **`domain/` es opcional.** Solo se crea cuando la aplicación tiene reglas de negocio, invariantes o
> modelos propios. Una app cuya única responsabilidad es orquestar sistemas externos (p. ej. un glue
> service entre dos APIs) puede vivir enteramente en `application`, sin inventar entidades artificiales
> solo para "seguir la plantilla".

### Validación (`@platform/core`)

No es una capa de `src/core/*` del proyecto, sino un export de la propia librería: la interfaz
[Standard Schema](https://standardschema.dev) y un helper para validar contra ella, compartidos por
todo lo demás que valida algo en `@platform/*` (`@platform/env`'s `loadEnv`, los validadores HTTP de
`infrastructure` — ver más abajo).

| Export                                  | Firma real                                                                                                                                                                                        | Uso típico                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StandardSchemaV1`                      | Tipo (no runtime): interfaz de interoperabilidad que implementan zod ≥3.24, valibot, arktype y el builder `env.*` de `@platform/env`.                                                             | Tipar un schema propio o de terceros sin acoplar el código a la API concreta de ninguna librería.                                                    |
| `validateStandardSchema(schema, value)` | `<Schema extends StandardSchemaV1>(schema: Schema, value: unknown) => { success: true, value } \| { success: false, issues: {path?, message}[] }`. Nunca tira — devuelve el resultado como valor. | Base de `loadEnv` (`@platform/env`) y de `parseJsonBody`/`parseQueryParams`/`parsePathParams` (`@platform/infrastructure`); rara vez se usa directo. |

## `infrastructure/`

Todas las implementaciones dependientes de una tecnología específica. Aquí sí se usan SDKs, ORMs y
librerías de terceros. **Nunca** implementa reglas de negocio.

#### Inventario de primitivas HTTP (`packages/infrastructure/src`)

| Clase/función                                                                                               | Firma real                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Uso típico                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HttpRequest`                                                                                               | Interfaz: `{ method, path, pathParams, queryParams, headers, rawBody }`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Forma normalizada de una request; es lo que produce cualquier `HttpRequestMapper` y lo que reciben los controllers en `apps/`.                                                                                                                                                           |
| `HttpResponse`                                                                                              | Interfaz: `{ statusCode, headers: Map<string,string>, body: string }`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Lo que devuelven los controllers y lo que serializa cada `deployment/*` a la respuesta nativa de su entorno.                                                                                                                                                                             |
| `HttpRequestMapper<T>`                                                                                      | `abstract class` con `abstract map(raw: T): Promise<HttpRequest>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Cada entorno implementa la suya: `AWSApiGatewayEventHttpMapper` (adapter-aws), `NodeHttpRequestMapper` (adapter-node).                                                                                                                                                                   |
| `HttpServer`                                                                                                | Interfaz: `listen(port): Promise<void>` / `close(): Promise<void>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Implementada por `NodeHttpServer`. No existe (ni tiene sentido) una implementación AWS: en Lambda el runtime invoca el handler directo, no hay servidor propio.                                                                                                                          |
| `createHttpDispatcher(mapRequest, handle)`                                                                  | `(rawEvent: TRawEvent) => Promise<HttpResponse>`. Envuelve mapeo + manejo en un único `try/catch` y traduce lo que capture con `toHttpError`: `HttpError` se serializa tal cual con `.toResponse()`; los errores de `core` (`NotFoundError`, `ValidationError`, `InvalidArgumentError`, `UpstreamTimeoutError`, `UpstreamServiceError`, `IntegrationMismatchError`) se mapean a su `HttpError` equivalente; cualquier otro error (incluido `UnexpectedError`) se envuelve como `InternalServerError('Unexpected server error')`.                                                                                                          | Es la pieza que conecta `apps/` con `infrastructure/deployment/*` (ver ejemplo end-to-end). Gracias a `toHttpError`, un caso de uso puede lanzar directamente un error de `core` (p. ej. `NotFoundError` de aplicación) sin que el controller tenga que traducirlo a mano a `HttpError`. |
| `toHttpError(err)`                                                                                          | `(err: unknown) => HttpError`. Mapeo explícito, exportado por separado para reutilizarlo fuera de `createHttpDispatcher` si hace falta serializar un error a mano.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Úsalo si necesitas la traducción de errores sin pasar por el dispatcher completo (p. ej. en un middleware propio).                                                                                                                                                                       |
| `toHttpResponse(result, options?)`                                                                          | `<T>(result: ApplicationResult<T>, options?: { successStatusCode?: number }) => HttpResponse`. Traduce el `ApplicationResult` (`@platform/core`, ver [`UseCase` y `ApplicationResult`](#usecase-y-applicationresult-el-estándar-de-respuesta-de-application)) que devuelve un `UseCase.execute` directo a `HttpResponse` — éxito es `200` (o `successStatusCode`) con `ok(data)` como body; error mapea el mismo set de `type` que `toHttpError` a su `HttpError` equivalente, y cualquier `type` fuera de ese set (incluidos los propios del proyecto sin mapeo explícito) cae en `InternalServerError('Unexpected server error')` sin reenviar el mensaje original. | Contraparte de `toHttpError` para el flujo basado en `ApplicationResult` en vez de excepciones — ver ejemplo en [`apps/`](#apps). |
| `parseJsonBody(request, schema)` / `parseQueryParams(request, schema)` / `parsePathParams(request, schema)` | `<Schema extends StandardSchemaV1>(request: HttpRequest, schema: Schema) => StandardSchemaV1.InferOutput<Schema>`. `parseJsonBody` parsea `rawBody` como JSON (tira `BadRequestError` 400 si no es JSON válido) y valida contra `schema`; los tres tiran `UnprocessableEntityError` (422) con `issues` como `details` si el valor no matchea. `StandardSchemaV1` vive en `@platform/core`, así que aceptan cualquier schema compatible: el builder `env.*` de `@platform/env` (mismo shape `Record<string,string\|undefined>` que `queryParams`/`pathParams`) o un validador de terceros (zod, valibot, arktype).                         | Validar el input de un controller sin reinventar el parseo/validación a mano en cada endpoint — ver ejemplo en `apps/`.                                                                                                                                                                  |
| `HttpError` + subclases                                                                                     | `abstract class HttpError extends ExtensibleError` (ver [Jerarquía de errores](#jerarquía-de-errores)) — punto de extensión público, un proyecto puede crear su propio error HTTP extendiéndola directo. `HttpError(statusCode, message, details?, cause?)`. Subclases listas para usar: `BadRequestError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `TimeoutError` (408), `ConflictError` (409), `UnprocessableEntityError` (422), `InternalServerError` (500), `BadGatewayError` (502), `ServiceUnavailableError` (503), `GatewayTimeoutError` (504) — todas con `(message?, details?, cause?)`. | Los controllers en `apps/` deben lanzar **estas** clases (o una propia que extienda `HttpError`), nunca `Error` genérico ni armar un `HttpResponse` de error a mano — `createHttpDispatcher` ya sabe traducirlas, incluidas las personalizadas.                                          |
| `HttpRoute`                                                                                                 | Interfaz: `{ method, path, handle }`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Unidad mínima de ruteo — una entrada por endpoint.                                                                                                                                                                                                                                       |
| `HttpRouter`                                                                                                | `constructor(routes: HttpRoute[])`; `dispatch` (arrow function, se puede pasar como referencia sin `bind`) resuelve la ruta matcheando `path` con soporte de params dinámicos (`:id`) y lanza `NotFoundError` si no matchea; `describe(): string[]` lista `"MÉTODO /path"` de cada ruta (útil para loguear al arrancar).                                                                                                                                                                                                                                                                                                                  | Úsalo apenas la app tenga **más de un endpoint** — reemplaza el patrón de un solo `controller.handle` cableado directo (ver corrección del ejemplo end-to-end más abajo).                                                                                                                |
| `HttpResponseCache`                                                                                         | Interfaz: `get(key): Promise<HttpResponse \| undefined>` / `set(key, response, ttlSeconds?): Promise<void>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Contrato para cachear `HttpResponse` fuera del proceso. Implementación de referencia: `RedisHttpResponseCache` (adapter-redis), que por dentro compone `RedisCache<T>` (ver [`Cache<T>`](#cachet)).                                                                                     |
| `withHttpCache(handle, cache, options?)`                                                                    | `(handle, cache: HttpResponseCache, options?: { ttlSeconds?, keyBuilder? }) => typeof handle`. Envuelve el `handle` de una `HttpRoute`: en un hit devuelve la respuesta cacheada sin llamar a `handle`; en un miss llama a `handle` y cachea la respuesta si es 2xx. Solo cachea `GET` por defecto — pasa `keyBuilder` si necesitas cachear otro método (la key por defecto no incluye el body).                                                                                                                                                                                                                                          | `{ method: "GET", path: "/orders/:id", handle: withHttpCache((req) => getOrderController.handle(req), cache, { ttlSeconds: 60 }) }` — composición manual sobre una `HttpRoute` puntual, no hay caching automático de todas las rutas.                                                    |
| `RedisHttpResponseCache` (adapter-redis)                                                                    | `implements HttpResponseCache`; constructor `(client: Redis, { keyPrefix?, logger? })` — recibe un cliente `ioredis` ya conectado, no lo crea. Adaptador delgado: por dentro delega en `RedisCache<SerializedHttpResponse>` y solo agrega la conversión `HttpResponse <-> SerializedHttpResponse`.                                                                                                                                                                                                                                                                                                                                        | `new RedisHttpResponseCache(new Redis(config.REDIS_URL), { logger })` en `infrastructure/deployment/*`, pasado a `withHttpCache` al armar las `routes`.                                                                                                                                  |
| `RestClient`                                                                                                | Interfaz `get(url, options?)` / `post\|put\|delete(url, params, options?)`, todas devuelven `Promise<{ data: T; meta: { statusCode } }>`; `options` es `{ headers?, timeoutMs? }`.                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Contrato para llamar sistemas externos vía REST. Implementación de referencia: `NodeFetchRestClient` (adapter-node, usa `fetch` nativo) — acepta `{ baseURL?, defaultHeaders?, defaultTimeoutMs? }` en el constructor para no repetir esa config en cada llamada.                        |
| `startLocalServer(routes, { port })` (adapter-node)                                                         | `(routes: HttpRoute[], options) => Promise<NodeHttpServer>`. Empaqueta `HttpRouter` + `NodeHttpRequestMapper` + `createHttpDispatcher` + `NodeHttpServer.listen` en una sola llamada.                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Reemplaza el bloque de wiring manual del ejemplo end-to-end cuando no necesitas un mapper distinto al de Node — sigue siendo composición explícita, solo agrupada.                                                                                                                       |
| `createLambdaHandler(routes)` (adapter-aws)                                                                 | `(routes: HttpRoute[]) => (event) => Promise<HttpResponse>`. Empaqueta `HttpRouter` + `AWSApiGatewayEventHttpMapper` + `createHttpDispatcher` en el handler que exporta el Lambda.                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `export const handler = createLambdaHandler(routes);` — mismo espíritu que `startLocalServer`, para el entorno AWS.                                                                                                                                                                      |
| `ApiResponse<T>` / `ok(data, meta?)`                                                                        | `ok<T>(data, meta?) => { data, meta? }`; `ApiResponse<T>` también admite `pagination`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Envoltorio para respuestas exitosas en los controllers, antes de serializar a `HttpResponse`.                                                                                                                                                                                            |

#### `EventBus`

Interfaz (`packages/infrastructure/src/EventBus.ts`): `publish(events: DomainEvent[]): Promise<void>`
/ `addSubscribers(subscribers: DomainEventSubscriber[]): void`. Es lo que `apps/`
cablea contra los `DomainEventSubscriber` del proyecto (ver
[Inventario de primitivas de dominio](#inventario-de-primitivas-de-dominio-packagescoresrcdomain))
y lo que un caso de uso usa para publicar lo que `entity.pullDomainEvents()` devuelve tras
persistir.

Implementación de referencia: **`InMemoryEventBus`** (`@platform/adapter-node`) — dispatcha cada
evento publicado a los subscribers cuyo `subscribedTo()` incluya su `EVENT_NAME`, en el mismo
proceso, sin broker. Sirve tanto para `deployment/local` como para tests (también se reexporta
desde `@platform/testing`, ver [`@platform/testing`](#platformtesting) más abajo). Cuando el
proyecto necesite publicar eventos entre procesos (colas, un broker real), se reemplaza por un
`EventBus` propio contra ese sistema — la interfaz no cambia, solo la implementación que se cablea
en `deployment/*`.

```ts
// infrastructure/deployment/local/server.ts
import { InMemoryEventBus } from "@platform/adapter-node";

const eventBus = new InMemoryEventBus();
eventBus.addSubscribers([new OrderCreatedListener(/* ... */)]);
// ... pasar `eventBus` a los casos de uso que necesiten publicar eventos tras persistir.
```

#### `Cache<T>`

Interfaz genérica (`packages/infrastructure/src/Cache.ts`): `get(key): Promise<T | undefined>` /
`set(key, value: T, ttlSeconds?): Promise<void>`. Mismo patrón que `RestClient`/`EventBus`: el
contrato tecnología-agnóstico vive en `infrastructure`, la implementación concreta en un adapter.
`HttpResponseCache` es la variante especializada para `HttpResponse` (ver tabla de primitivas HTTP
más arriba) — `Cache<T>` es para cualquier otro valor cacheable (resultado de un `UseCase`, un
objeto de dominio, un token, etc.).

Implementación de referencia: **`RedisCache<T>`** (`@platform/adapter-redis`) — constructor
`(client: Redis, { keyPrefix?, logger?, serialize?, deserialize? })`, recibe un cliente `ioredis`
ya conectado. Es un cache, no una fuente de verdad: si Redis falla o una entrada está corrupta,
degrada a cache miss (logueado vía `logger`, si se pasa) en vez de propagar el error. Serializa con
`JSON.stringify`/`JSON.parse` por defecto; `serialize`/`deserialize` lo overridean.
`RedisHttpResponseCache` (misma librería) es un adaptador delgado construido sobre
`RedisCache<SerializedHttpResponse>` — toda la mecánica de Redis vive una sola vez en `RedisCache`.

```ts
import Redis from "ioredis";
import { RedisCache } from "@platform/adapter-redis";
import type { Cache } from "@platform/infrastructure";

type Product = { id: string; name: string; price: number };

const productCache: Cache<Product> = new RedisCache<Product>(new Redis(config.REDIS_URL), {
  keyPrefix: "products:",
  logger,
});
```

### `infrastructure/deployment/`

Adaptadores que ejecutan la aplicación en un entorno concreto (AWS Lambda, servidor HTTP local, cron,
consumers de eventos). Dependencia: `deployment → apps`.

- `deployment/aws/` — usa `@platform/adapter-aws`:
  - `AWSApiGatewayEventHttpMapper` — `extends HttpRequestMapper<APIGatewayProxyEventV2>`, sin argumentos
    de constructor; mapea `event.requestContext.http.method`, `rawPath`, `pathParameters`,
    `queryStringParameters`, `headers` y `body` al `HttpRequest` normalizado. Si el evento no matchea la
    forma esperada, lanza `MalformedApiGatewayEventError` (`AdapterError` — rama `PlatformError`, ver
    [Jerarquía de errores](#jerarquía-de-errores); no está pensado para que lo capture lógica de
    negocio, solo para diagnóstico/logging de un mal wiring del Lambda).
  - `AWSLoggerClient` — `extends Logger` (de `core`); constructor recibe
    `{ serviceName, logLevel?, sensitiveKeys? }` (`logLevel` opcional — si se omite, `@aws-lambda-powertools/logger`
    aplica su propio default) y delega en esa librería por debajo.
  - `createLambdaHandler(routes: HttpRoute[])` — empaqueta `HttpRouter` + `AWSApiGatewayEventHttpMapper`
    - `createHttpDispatcher` en el handler que exporta el Lambda (ver ejemplo end-to-end).
- `deployment/local/` — para levantar un servidor HTTP nativo de Node en desarrollo/local, usa
  `@platform/adapter-node`:
  - `NodeHttpRequestMapper` — `extends HttpRequestMapper<IncomingMessage>`, **sin argumentos de
    constructor**; parsea query string, headers y body (`req.on('data'/'end')`) de un request nativo de
    Node. Si el request no se puede parsear lanza `MalformedHttpRequestError`, y si el stream del body
    falla a mitad de lectura (p. ej. conexión abortada por el cliente) lanza `HttpRequestStreamError` —
    ambos `AdapterError` (rama `PlatformError`, ver [Jerarquía de errores](#jerarquía-de-errores)).
  - `NodeHttpServer` — `implements HttpServer`; constructor `(dispatch, routes: string[] = [])` — el
    array `routes` es solo texto para loguear al arrancar (`[local]   POST /orders`), **no** participa en
    el ruteo real (eso lo hace `HttpRouter` o el propio `dispatch` si hay un único endpoint). `listen()`
    rechaza con `HttpServerListenError` si falla el bind al puerto (puerto ocupado, permisos), y
    `close()` rechaza con `HttpServerCloseError` si el cierre falla — ambos `AdapterError`.
  - `startLocalServer(routes: HttpRoute[], { port })` — empaqueta `HttpRouter` +
    `NodeHttpRequestMapper` + `createHttpDispatcher` + `NodeHttpServer.listen` en una sola llamada (ver
    ejemplo end-to-end); devuelve el `NodeHttpServer` ya escuchando por si necesitas `.close()`.
  - `NodeFetchRestClient` — `implements RestClient`; constructor opcional
    `{ baseURL?, defaultHeaders?, defaultTimeoutMs? }` (se mezclan con `options` de cada llamada, que
    gana si hay conflicto); usa `fetch` nativo + `AbortSignal.timeout(timeoutMs)`; en `post` detecta
    `Content-Type: application/x-www-form-urlencoded;charset=UTF-8` para enviar `URLSearchParams` en vez
    de JSON. Lanza `UpstreamTimeoutError`/`UpstreamServiceError` (`core`, ver tabla de errores de
    aplicación) en timeout, error de red, respuesta no-2xx, o —también— si una respuesta 2xx trae un
    body que no es JSON válido.
  - `NodeConsoleLoggerClient` — `extends Logger`; constructor `(sensitiveKeys?: string[])`; loguea a
    `console.*` con prefijo `[INFO]/[ERROR]/[WARN]/[DEBUG]`.

### `infrastructure/clients/`

Clientes hacia sistemas externos (REST, GraphQL, gRPC, SFTP, brokers de eventos). Ejemplo:
`clients/rest/SendEmailRestClient.ts` implementando el `RestClient` de
`@platform/infrastructure` (o usando `NodeFetchRestClient` directamente).

### `infrastructure/persistence/`

Implementaciones de los repositorios que define `domain`/`application` (DynamoDB, PostgreSQL, MongoDB,
Redis, etc.). Aísla completamente el dominio del motor de persistencia. Ejemplo:
`persistence/SaveOrderDynamoDB.ts`.

### `infrastructure/env.ts`

Único punto donde se lee `process.env`. El resto del código recibe configuración ya parseada/tipada por
inyección manual (parámetros de constructor) — nunca lee `process.env` directamente fuera de este
archivo.

Para no reinventar el parseo/validación a mano en cada proyecto, este archivo se apoya en
`@platform/env` (`loadEnv` + el builder `env.*`):

```ts
// src/infrastructure/env.ts
import { loadEnv, env } from "@platform/env";

const schema = env.object({
  PORT: env.number().default(3000),
  DATABASE_URL: env.string(),
  LOG_LEVEL: env.enum(["debug", "info", "warn", "error"]).default("info"),
  FEATURE_X: env.boolean().optional(),
});

// loadEnv valida sincrónicamente contra process.env y tira EnvValidationError si algo falta o
// no matchea — se llama una sola vez acá, al importar el módulo, para que el proceso falle al
// arrancar (cold start de Lambda o boot del server local) y no a mitad de un request.
export const config = loadEnv(schema);
```

#### Inventario de `@platform/env`

| Export                                                                           | Firma real                                                                                                                                                                                                                                       | Uso típico                                                                                                          |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `loadEnv(schema, source?)`                                                       | `<Schema extends StandardSchemaV1>(schema: Schema, source: Record<string, string \| undefined> = process.env) => StandardSchemaV1.InferOutput<Schema>`. Valida `source` sincrónicamente; tira `EnvValidationError` si `schema` rechaza el valor. | Única llamada real de `env.ts`. `source` es inyectable — útil para testear `env.ts` sin mutar `process.env` global. |
| `env.object(shape)` / `.string()` / `.number()` / `.boolean()` / `.enum(values)` | Builder propio, sin dependencias de terceros. Cada valor soporta `.optional()` y `.default(value)`.                                                                                                                                              | Uso por defecto cuando el proyecto no necesita validaciones más allá de tipo/presencia/enum.                        |
| `env.url()` / `.port()`                                                          | `url()` valida con `new URL(value)` (lanza issue si no parsea) y devuelve el string tal cual; `port()` valida un entero en el rango 1-65535.                                                                                                     | `DATABASE_URL: env.url()`, `PORT: env.port().default(3000)` — mismo builder, sin reinventar la validación en `env.ts`. |
| `env.array(itemSchema, { separator? })`                                          | `<Schema extends StandardSchemaV1>(itemSchema: Schema, options?: { separator?: string }) => EnvValueSchema<InferOutput<Schema>[]>`. Separa `value` por `separator` (`","` por defecto) y valida cada token contra `itemSchema` — cualquier Standard Schema, no solo los de este builder. | `ALLOWED_ORIGINS: env.array(env.url())` para `"https://a.com,https://b.com"` sin un `.split(",")` a mano fuera de `env.ts`. |
| `env.json(schema?)`                                                              | `(schema?: StandardSchemaV1) => EnvValueSchema<unknown \| InferOutput<Schema>>`. Parsea `value` como JSON (issue si no es JSON válido) y, si se pasa `schema`, valida el resultado contra él — mismo dos pasos que `parseJsonBody` (`infrastructure`). | `FEATURE_FLAGS: env.json(z.object({ betaUi: z.boolean() }))` sin un `JSON.parse` suelto fuera de `env.ts`.          |
| `EnvValidationError`                                                             | `extends ApplicationError` (`core`); `readonly issues: {path?, message}[]`; `origin = '@platform/env'`. **No** está mapeado en `toHttpError` — nunca se espera en tiempo de request.                                                             | Se captura solo en el arranque del proceso (o en tests de `env.ts`), no en controllers.                             |
| `StandardSchemaV1`                                                               | Tipo (no runtime), re-exportado desde `@platform/core` por conveniencia — ver [Validación](#validación-platformcore).                                                                                                                            | Permite tipar un schema propio o de terceros sin acoplar `env.ts` a la API concreta de ninguna librería.            |

**Cambiar a zod (o cualquier otro validador Standard Schema) más adelante no requiere tocar
`loadEnv` ni escribir ningún adapter** — el schema de zod ya implementa `~standard`:

```ts
import { loadEnv } from "@platform/env";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const config = loadEnv(schema); // mismo loadEnv, cero cambios fuera de este archivo
```

Para `.env` local (solo `deployment/local`, Lambda ya recibe sus env vars inyectadas por la
plataforma/IaC): Node ≥20.6 trae `process.loadEnvFile()` nativo — no hace falta el paquete `dotenv`
ni un helper propio, se llama una vez antes de `loadEnv` en el bootstrap del server local.

## `@platform/testing`

Dobles listos para usar en tests, para no reescribir en cada proyecto lo que el propio ejemplo
end-to-end de este documento ya pide escribir a mano (el `InMemoryTicketRepository` del README).
Pensado como `devDependency` — no viaja a producción.

| Export                            | Firma real                                                                                                                                                                                                  | Uso típico                                                                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `InMemoryRepository<TId, TEntity>` | `abstract class` con `save`/`findById`/`findAll`/`delete` sobre un `Map<TId, TEntity>` interno; `TEntity extends { id: { value: TId } }`.                                                                  | `class InMemoryOrderRepository extends InMemoryRepository<string, Order> {}` en vez de reescribir el `Map` en cada proyecto/test.        |
| `FakeLogger`                       | `extends Logger` (`core`); en vez de imprimir, acumula las llamadas en `calls.{info,error,warn,debug}` (ya pasadas por `this.mask`, igual que un logger real).                                            | `expect(fakeLogger.calls.error).toHaveLength(1)` en el test de un `UseCase` sin acoplarse a `console.*`.                                 |
| `buildHttpRequest(overrides?)`     | `(overrides?: Partial<HttpRequest>) => HttpRequest`. Devuelve un `HttpRequest` válido con defaults (`GET /`, sin headers/query/body) y lo que se pase en `overrides` encima.                               | Test de un controller de `apps/` sin armar el objeto `HttpRequest` completo a mano.                                                       |
| `InMemoryEventBus`                 | Reexportado desde `@platform/adapter-node` — ver [`EventBus`](#eventbus). El mismo doble sirve para `deployment/local` y para tests, así que no hace falta duplicarlo acá.                                  | `const eventBus = new InMemoryEventBus(); eventBus.addSubscribers([...]);` en el setup de un test de integración.                        |

## `shared/`

Componentes reutilizables **exclusivos de esta aplicación** (no de otros proyectos). No es un cajón de
utilidades genéricas. Todo lo que termine siendo útil entre varias aplicaciones debe migrar a
`@platform/*` (core o infrastructure), no quedarse duplicado en `shared`.

```
src/shared
└── MyProjectExclusiveHelper.ts
```

## `index.ts`

Barrel de exports públicos de la aplicación: reexporta los tipos y símbolos que el proyecto expone
hacia afuera (por ejemplo si otro servicio importa tipos de este proyecto). No contiene lógica de
arranque ni composición — el bootstrap de cada entorno vive en su adaptador de
`infrastructure/deployment/*`, no en `index.ts`.

## Composición manual: ejemplo end-to-end

Nada de contenedores de DI. Cada `deployment/*` cablea a mano sus dependencias y se las pasa al `app`:

```ts
// src/infrastructure/deployment/local/server.ts
import type { HttpRoute } from "@platform/infrastructure";
import { startLocalServer, NodeConsoleLoggerClient } from "@platform/adapter-node";
import { CreateOrderController } from "../../../apps/CreateOrderController.js";
import { GetOrderController } from "../../../apps/GetOrderController.js";
import { CreateOrder } from "../../../core/application/CreateOrder.js";
import { GetOrder } from "../../../core/application/GetOrder.js";
import { InMemoryOrderRepository } from "../../persistence/InMemoryOrderRepository.js";

const logger = new NodeConsoleLoggerClient();
const orderRepository = new InMemoryOrderRepository();
const createOrderController = new CreateOrderController(new CreateOrder(orderRepository, logger));
const getOrderController = new GetOrderController(new GetOrder(orderRepository, logger));

// El ruteo real vive acá — es lo único específico del proyecto en este archivo.
const routes: HttpRoute[] = [
  { method: "POST", path: "/orders", handle: (req) => createOrderController.handle(req) },
  { method: "GET", path: "/orders/:id", handle: (req) => getOrderController.handle(req) },
];

// startLocalServer empaqueta HttpRouter + NodeHttpRequestMapper + createHttpDispatcher +
// NodeHttpServer.listen — sigue siendo composición manual, solo agrupada en una llamada.
await startLocalServer(routes, { port: 3000 });
```

Cambiar de `deployment/local` a `deployment/aws` significa escribir un handler nuevo que cablea
`createLambdaHandler` (mismos `routes`, mismo shape) + `AWSLoggerClient` en vez de sus equivalentes Node:

```ts
// src/infrastructure/deployment/aws/handler.ts
import { createLambdaHandler } from "@platform/adapter-aws";
// ... mismo cableado de controllers/casos de uso que arriba, con AWSLoggerClient en vez de
// NodeConsoleLoggerClient, y los mismos `routes` (HttpRoute no depende de ningún SDK).
export const handler = createLambdaHandler(routes);
```

**`apps/` y `core/` no cambian una línea** — el `HttpRoute[]` y los `controller.handle` son los mismos en
ambos entornos.

## Cuándo SÍ / NO crear una abstracción

| Señal                                                                       | Acción                                                                                                                            |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Vas a tener DynamoDB hoy y Postgres el próximo trimestre                    | Interfaz de repositorio en `application`, implementaciones en `persistence/`                                                      |
| Necesitas testear el caso de uso sin red/DB real                            | Interfaz + implementación in-memory para tests                                                                                    |
| "Por si en el futuro cambiamos de proveedor" sin plan concreto              | **No** crear la interfaz todavía                                                                                                  |
| Una sola implementación, sin necesidad de test doble, sin plan de reemplazo | Clase concreta directa, sin interfaz                                                                                              |
| Necesitas un error de negocio/HTTP propio del proyecto                      | Extender `ApplicationError`/`DomainError`/`HttpError` — nunca `PlatformError` (ver [Jerarquía de errores](#jerarquía-de-errores)) |

## Anti-patrones

- Reglas de negocio dentro de `infrastructure/` o `apps/` (deberían vivir en `core/domain` o `core/application`).
- `core/` importando algo de `infrastructure/` (la flecha de dependencia va al revés).
- Interfaces creadas sin una segunda implementación real ni un test doble que las use.
- Contenedor de DI (`tsyringe`, `inversify`, decoradores `@Injectable`) introducido sin haber sentido
  primero el dolor de la composición manual.
- `shared/` usado como repositorio de utilidades genéricas entre proyectos — eso pertenece a `core` o
  `infrastructure` de este monorepo.
- Leer `process.env` fuera de `infrastructure/env.ts`.
- Extender `PlatformError`/`AdapterError` desde el código del proyecto — esa rama es exclusiva de estas
  librerías; los errores propios van sobre `ApplicationError`, `DomainError` o `HttpError` (ver
  [Jerarquía de errores](#jerarquía-de-errores)).
- Un `UseCase.execute` que lanza un error de negocio esperado en vez de devolverlo como
  `ApplicationResult` (ver [`UseCase` y `ApplicationResult`](#usecase-y-applicationresult-el-estándar-de-respuesta-de-application)) — rompe el contrato para quien lo llama, que ya no puede confiar en que `execute` no lanza.

## Decisión rápida: "¿dónde va esto?"

```
¿Qué estás escribiendo?
├─ Entra por HTTP/evento/cron y llama a un caso de uso → apps/
├─ Orquesta un caso de uso (sin reglas de negocio) → core/application/
├─ Entidad, value object, regla de negocio, evento de dominio → core/domain/
├─ Arranca el proceso (Lambda handler, servidor HTTP, cron) → infrastructure/deployment/{aws,local}/
├─ Habla con un sistema externo (API, broker) → infrastructure/clients/
├─ Implementa un repositorio (DynamoDB, Postgres...) → infrastructure/persistence/
├─ Lee variables de entorno → infrastructure/env.ts (solo aquí)
├─ Es un error de negocio/HTTP propio del proyecto → extiende ApplicationError/DomainError/HttpError
└─ Reutilizable solo en este proyecto, no genérico → shared/
```
