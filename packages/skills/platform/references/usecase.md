# `UseCase`/`ApplicationResult` y `apps/`

> Referencia de `platform/SKILL.md`. Ver el índice para cuándo leer cada archivo de
> `references/`.

## El estándar de respuesta de `core/application/`

Todo caso de uso implementa `UseCase<TCommand, TData>` (`packages/core/src/application/UseCase.ts`)
y devuelve un `ApplicationResult<TData>` en vez de lanzar sus errores de negocio esperados. Solo
debería escapar como excepción sin capturar algo que el propio caso de uso no anticipó (un bug
real).

| Export                       | Firma real                                                                                                                                                                                                                                                 | Uso típico                                                                                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ApplicationResult<T>`       | `{ ok: true, data: T } \| { ok: false, error: { type, origin?, message, data? } }`.                                                                                                                                                                        | Tipo de retorno de todo `UseCase.execute`.                                                                                                                                                                       |
| `toApplicationSuccess(data)` | `<T>(data: T) => ApplicationResultSuccess<T>`.                                                                                                                                                                                                             | Construir el resultado exitoso de un caso de uso.                                                                                                                                                                |
| `toApplicationFailure(err)`  | `(err: unknown) => ApplicationResultError`. Si `err` es un `ApplicationError` (o subclase de `DomainError`/`HttpError`), reutiliza su `toScalars()` — ver [`errores.md`](./errores.md). Cualquier otro `unknown` se envuelve primero en `UnexpectedError`. | Capturar dentro de `execute()` cualquier error, de negocio o inesperado, antes de devolverlo.                                                                                                                    |
| `UseCase<TCommand, TData>`   | `interface { execute(command: TCommand, context?: RequestContext): Promise<ApplicationResult<TData>> }` — ver § "Propagación de `RequestContext`" abajo para el segundo parámetro.                                                                         | Contrato que implementa cada caso de uso de `core/application`.                                                                                                                                                  |
| `matchApplicationResult`     | `<T, R>(result: ApplicationResult<T>, { onSuccess, onError }) => R`.                                                                                                                                                                                       | Pattern-matching sobre un `ApplicationResult` fuera de un controller HTTP (donde ya existe `toHttpResponse`) — un listener de eventos, un job, un test. Evita el `if (result.ok) { ... } else { ... }` repetido. |

## `BaseUseCase` — forma por defecto

El `try/catch` + `toApplicationSuccess`/`toApplicationFailure` es idéntico en todo caso de uso —
`BaseUseCase` (`packages/core/src/application/BaseUseCase.ts`) lo implementa una sola vez: extender
la clase y escribir solo `handle()` con la lógica real.

```ts
// core/application/CreateOrder.ts
import { BaseUseCase, type Logger } from "@platform/core";

export class CreateOrder extends BaseUseCase<CreateOrderCommand, Order> {
  constructor(
    private readonly orderRepository: OrderRepository,
    logger?: Logger,
  ) {
    super(logger);
  }

  protected async handle(command: CreateOrderCommand): Promise<Order> {
    const order = Order.create(command);
    await this.orderRepository.save(order);
    return order;
  }
}
```

`BaseUseCase` loguea automáticamente `` `${this.constructor.name} failed` `` en el `catch` (si se
pasó un `logger`), así que el nombre del caso de uso en el mensaje de log nunca queda desactualizado
por un copy/paste.

### Forma manual (`UseCase` directo)

Sigue siendo el camino correcto cuando `execute` necesita algo más que "correr `handle` y capturar"
— por ejemplo, varios pasos con lógica de compensación entre ellos, o un `try/catch` con manejo
distinto por tipo de error:

```ts
// core/application/CreateOrder.ts — forma manual, equivalente a la de arriba
import {
  UseCase,
  ApplicationResult,
  Logger,
  toApplicationSuccess,
  toApplicationFailure,
} from "@platform/core";

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

## `apps/`

Puntos de entrada propios de la aplicación. Adaptan una interacción externa (HTTP, evento, comando,
proceso programado) a un caso de uso del dominio. **No** contienen reglas de negocio ni
dependencias específicas de infraestructura (nada de SDKs de AWS, drivers de base de datos, etc. —
eso vive en `infrastructure/deployment`).

```
src/apps
├── createOrderRoute.ts
├── OrderCreatedListener.ts
└── ...
```

### `route()` — forma por defecto para un endpoint con un solo caso de uso

`route()` (`packages/infrastructure/src/http/route.ts`) arma un `HttpRoute["handle"]` directo a
partir de un `UseCase` y un mapeo de request a comando — parsear input, llamar al caso de uso,
traducir el resultado es siempre la misma forma para el caso común:

```ts
// apps/createOrderRoute.ts
import { route, parseJsonBody, type HttpRoute } from "@platform/infrastructure";
import { z } from "zod";
import type { CreateOrder } from "../core/application/CreateOrder.js";

const CreateOrderBody = z.object({ customerId: z.string(), items: z.array(z.string()).min(1) });

export const createOrderRoute = (createOrder: CreateOrder): HttpRoute => ({
  method: "POST",
  path: "/orders",
  handle: route(createOrder, (req) => parseJsonBody(req, CreateOrderBody), {
    successStatusCode: 201,
  }),
});
```

`parseJsonBody`/`parseQueryParams`/`parsePathParams` (`@platform/infrastructure`, ver
[`http.md`](./http.md)) validan el input al entrar — esos sí lanzan
(`BadRequestError`/`UnprocessableEntityError`), porque ocurren antes de llegar al caso de uso y el
dispatcher los captura igual que siempre.

### Forma manual (controller-clase)

Sigue siendo el camino correcto cuando el endpoint necesita algo más que "parsear, ejecutar,
traducir" — headers custom en la respuesta, side effects antes/después de llamar al caso de uso,
lógica condicional sobre el propio request:

```ts
// apps/CreateOrderController.ts — forma manual, equivalente a route() para el caso simple
import {
  parseJsonBody,
  toHttpResponse,
  type HttpRequest,
  type HttpResponse,
} from "@platform/infrastructure";
import { z } from "zod";
import { CreateOrder } from "../core/application/CreateOrder.js";

const CreateOrderBody = z.object({ customerId: z.string(), items: z.array(z.string()).min(1) });

export class CreateOrderController {
  constructor(private readonly createOrder: CreateOrder) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const body = parseJsonBody(request, CreateOrderBody);
    const result = await this.createOrder.execute(body);
    return toHttpResponse(result, { successStatusCode: 201 });
  }
}
```

Ver [`composicion.md`](./composicion.md) para el ejemplo end-to-end completo (wiring en
`infrastructure/deployment/{local,aws}`).

## Propagación de `RequestContext`

`UseCase.execute(command, context?)` acepta un segundo parámetro opcional,
`RequestContext` (`{ requestId, traceId?, timestamp }`, `@platform/core`) — id de correlación
end-to-end, explícito en vez de vía `AsyncLocalStorage` implícito (ver SKILL.md § Filosofía).
`BaseUseCase` ya lo usa: si se pasa `context`, loguea el fallo con `this.logger?.bind(context)` en
vez de `this.logger` directo, así que el `requestId` (y `traceId`, si hay) aparece en esa línea sin
que el caso de uso tenga que armarlo a mano.

Quién genera y pasa el `context`:

- **Eje HTTP:** `createHttpDispatcher` genera/propaga el `requestId` una sola vez (de un header
  `x-request-id` entrante, o generado) y lo deja en `request.requestId`. `route()` (ver
  [`http.md`](./http.md)) arma el `RequestContext` a partir de ahí y lo pasa a
  `useCase.execute(command, context)` — no hace falta nada adicional en un endpoint que usa
  `route()`. Un controller-clase manual que quiera lo mismo llama
  `createRequestContext({ requestId: request.requestId })` explícitamente.
- **Eje mensajería:** el `id` de un `MessageEnvelope` (ver [`eventos.md`](./eventos.md)) ya sirve
  como `requestId` — un `MessageRoute["handle"]` que quiera loguear con contexto llama
  `createRequestContext({ requestId: envelope.id })` y lo pasa a `useCase.execute`.
- **Llamadas salientes:** `RestClientOptions.context` (ver [`http.md`](./http.md)) — si el `UseCase`
  recibió un `context`, puede reenviarlo tal cual a cualquier `RestClient` que dependa, y
  `NodeFetchRestClient` propaga `x-request-id`/`traceparent` automáticamente en la llamada saliente.
