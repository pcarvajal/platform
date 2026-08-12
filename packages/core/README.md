# @platform/core

Paquete base de la plataforma: no depende de ningún otro paquete de este monorepo. Define la
jerarquía de errores compartida por toda la pila, el estándar de respuesta de la capa de
aplicación (`UseCase`/`BaseUseCase`/`ApplicationResult`), `Logger`, los contextos transversales
(`RequestContext`, `AppContext`), las primitivas de dominio (DDD) y la interfaz de validación
(Standard Schema) sobre la que se construyen `@platform/env` e `@platform/infrastructure`.

Referencia completa (firmas exactas, tabla de errores por defecto, ejemplos): ver
[`platform/SKILL.md`](../skills/platform/SKILL.md) § Jerarquía de errores,
§ `core/`.

## Jerarquía de errores

```
                     StructuredError
                ↙                     ↘
       PlatformError              ExtensibleError
 (errores DE @platform/* —        (punto de extensión público —
  nunca extender desde              tus errores van acá)
  código de proyecto)           ↙        ↓         ↘
       ↓                ApplicationError DomainError HttpError
   AdapterError                                    (@platform/infrastructure)
(adapter-aws/node)
```

Todo error (de librería o de proyecto) hereda `toScalars()`, que serializa
`{ type, origin?, description, data }` — `data` refleja automáticamente cualquier propiedad
`readonly` que declares en el constructor del error (incluido `cause`, si se pasó uno) sin tener
que armar el payload a mano:

```ts
import { ApplicationError } from "@platform/core";

export class OrderAlreadyShippedError extends ApplicationError {
  readonly type = "OrderAlreadyShippedError";
  constructor(readonly orderId: string) {
    super(`Order ${orderId} was already shipped`);
  }
}
// toScalars() => { type: "OrderAlreadyShippedError", description: "...", data: { orderId: "..." } }
```

Extiende `ApplicationError` o `DomainError` para tus propios errores — nunca `PlatformError` (es
exclusiva de estas librerías: `err instanceof PlatformError` significa "esto vino del framework").
`core` ya trae por defecto `ValidationError`, `NotFoundError`, `UpstreamServiceError`,
`UpstreamTimeoutError`, `IntegrationMismatchError`, `UnexpectedError` (application) e
`InvalidArgumentError`, `UnreachableCaseError` (domain), listos para usar sin subclasificar.
`assertNever(value)` tira `UnreachableCaseError` — útil como `default` de un `switch` exhaustivo
sobre una unión, para que un miembro nuevo agregado a la unión sin actualizar todos los `switch`
falle en runtime en vez de silenciarse.

## `UseCase` / `ApplicationResult`

`BaseUseCase` es la forma por defecto — el `try/catch` + `toApplicationSuccess`/
`toApplicationFailure` (siempre igual en cualquier caso de uso) vive una sola vez ahí, y loguea
automáticamente `` `${this.constructor.name} failed` `` si se pasa un `logger`:

```ts
import { BaseUseCase, type Logger } from "@platform/core";

export class CreateOrder extends BaseUseCase<CreateOrderCommand, Order> {
  constructor(
    private readonly orders: OrderRepository,
    logger?: Logger,
  ) {
    super(logger);
  }

  protected async handle(command: CreateOrderCommand): Promise<Order> {
    const order = Order.create(command);
    await this.orders.save(order);
    return order;
  }
}
```

`UseCase<TCommand, TData>` sigue disponible para implementar a mano cuando `execute` necesita algo
más que "correr `handle` y capturar" (ver
[`references/usecase.md`](../skills/platform/references/usecase.md)):

```ts
import { toApplicationSuccess, toApplicationFailure, type UseCase } from "@platform/core";

export class CreateOrder implements UseCase<CreateOrderCommand, Order> {
  constructor(private readonly orders: OrderRepository) {}

  async execute(command: CreateOrderCommand) {
    try {
      const order = Order.create(command);
      await this.orders.save(order);
      return toApplicationSuccess(order);
    } catch (err) {
      return toApplicationFailure(err);
    }
  }
}
```

En ambos casos, `execute()` nunca lanza un error de negocio esperado — lo captura y lo devuelve
como `ApplicationResult` (`{ ok: true, data } | { ok: false, error }`). `toHttpResponse`
(`@platform/infrastructure`) es la contraparte que traduce ese resultado a la respuesta HTTP
correcta en la capa de `apps/`; `matchApplicationResult(result, { onSuccess, onError })` hace lo
mismo fuera de un controller HTTP (un listener de eventos, un job, un test), sin repetir
`if (result.ok) { ... } else { ... }` a mano.

## `Logger`

Clase base abstracta (`info`/`error`/`warn`/`debug`, cada uno con `message` + `context?` opcional)
que reciben `UseCase`/`BaseUseCase` por inyección manual — nunca se instancia directo, cada paquete
de deployment trae su implementación concreta (`NodeConsoleLoggerClient` en `adapter-node`,
`AWSLoggerClient` en `adapter-aws`, `FakeLogger` en `@platform/testing`). Enmascara campos
sensibles (`password`, `token`, `secret`, etc., más los que agregues por constructor) en todo
`context` antes de que la subclase concreta lo loguee.

`logger.bind(context: RequestContext)` devuelve un `Logger` que mezcla `requestId`/`traceId` en
cada llamada sin que cada call site los pase a mano — `BaseUseCase` ya lo usa si `execute` recibe
un `context`. `LogLevel` (`"error" | "info" | "warn" | "debug" | "silent"`) y su contraparte en
runtime `LOG_LEVELS` son el tipo/valores que consume `APP_LOG_LEVEL` del contexto de aplicación
(ver abajo).

## Contexto (`RequestContext` / `AppContext`)

Dos contextos transversales, de vida distinta:

- **`RequestContext`** (`{ requestId, traceId?, timestamp }`, `createRequestContext(overrides?)`) —
  por request/mensaje entrante. Generado una vez por `createHttpDispatcher`/un `MessageEnvelope`
  entrante y propagado explícitamente: `execute(command, context)`, `Logger#bind(context)`,
  `RestClientOptions#context`. Nunca vía `AsyncLocalStorage` implícito.
- **`AppContext`** (`{ APP_SERVICE_NAME, APP_ENVIRONMENT, APP_LOG_LEVEL }`) — por proceso, resuelto
  una sola vez al arrancar (`infrastructure/env.ts` vía `env.appContext`, `@platform/env`) y
  obligatorio en todo proyecto sobre esta convención — ver
  [`references/env.md`](../skills/platform/references/env.md). Extensible: `env.appContext(extra)`
  intersecta `AppContext` con lo que agregue el proyecto (`PORT`, `DATABASE_URL`, etc.).

## Primitivas de dominio

`ValueObject<T>`, `EnumValueObject<T>`, `PatternValueObject`, `DateValueObject`,
`AggregateRoot<TScalar>`, `DomainEvent<TAttributes>`, `DomainEventSubscriber<T>`, `Uuid` — building
blocks de DDD para `core/domain/` en un proyecto consumidor. `AggregateRoot.record()`/
`pullDomainEvents()` es el mecanismo estándar para acumular y publicar eventos de dominio (vía el
`EventBus` de `@platform/infrastructure`) después de persistir.

## Validación

`StandardSchemaV1` — el tipo de interoperabilidad de [Standard Schema](https://standardschema.dev)
(compatible con zod, valibot, arktype) y `validateStandardSchema` que lo consumen tanto
`@platform/env` como los parsers HTTP de `@platform/infrastructure`, para no atar el resto de la
librería a un validador concreto.

## Consumo

```ts
import { ApplicationError, toApplicationFailure, ValueObject } from "@platform/core";
```

`"@platform/core": "workspace:*"` (o `file:../platform/packages/core`) — ver
[README raíz](../../README.md) § Instalación para el flujo completo de copiar el paquete a un
proyecto consumidor.
