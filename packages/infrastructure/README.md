# @platform/infrastructure

Primitivas HTTP y de mensajería, más los "puertos" (interfaces tecnología-agnósticas, implementadas
por un adapter concreto) que el resto de la plataforma usa para hablar con el exterior:
`RestClient`, `EventBus`, `Cache<T>`, `IdempotencyStore`. Depende solo de `@platform/core`.

Referencia completa (firmas exactas, tabla de mapeo HTTP, ejemplo end-to-end): ver
[`platform/SKILL.md`](../skills/platform/SKILL.md) § `infrastructure/`.

## Estructura interna

```
src/
├── http/       HttpRequest, HttpResponse, HttpRouter, route(), HttpError + subclases,
│               createHttpDispatcher, toHttpResponse/toHttpError, withHttpCache, validateRequest
│               (parseJsonBody/parseQueryParams/parsePathParams), HttpRequestMapper...
├── messaging/  MessageEnvelope, MessageRoute + bySource, createMessageDispatcher, withIdempotency
│               — eje async (SQS/EventBridge/cualquier broker), simétrico al eje HTTP.
└── ports/      RestClient, EventBus, Cache<T>, IdempotencyStore, ApiResponse — contratos sin
                implementación propia; cada uno tiene una implementación de referencia en un adapter
                (`@platform/adapter-node`, `@platform/adapter-aws`, `@platform/adapter-redis`,
                `@platform/testing`).
```

## HTTP

`route()` es la forma por defecto para un endpoint con un solo caso de uso — parsea, ejecuta,
traduce, sin código repetido:

```ts
// apps/createOrderRoute.ts
import { route, parseJsonBody, type HttpRoute } from "@platform/infrastructure";
import type { CreateOrder } from "../core/application/CreateOrder.js";

export const createOrderRoute = (createOrder: CreateOrder): HttpRoute => ({
  method: "POST",
  path: "/orders",
  handle: route(createOrder, (req) => parseJsonBody(req, CreateOrderBody), {
    successStatusCode: 201,
  }),
});
```

Un controller-clase manual sigue siendo el camino correcto cuando `handle` necesita algo más que
"parsear, ejecutar, traducir" (headers custom, side effects antes/después) — mismo tipo
`HttpRoute["handle"]` en ambos casos, así que `HttpRouter`/`createHttpDispatcher` no distinguen uno
de otro:

```ts
export class CreateOrderController {
  constructor(private readonly createOrder: CreateOrder) {}
  async handle(request: HttpRequest): Promise<HttpResponse> {
    const body = parseJsonBody(request, CreateOrderBody);
    const result = await this.createOrder.execute(body);
    return toHttpResponse(result, { successStatusCode: 201 });
  }
}
```

`HttpRoute[]` + `HttpRouter` (matchea método + path, soporta segmentos `:param`, tira `NotFoundError`
si nada matchea) + `createHttpDispatcher` (adapta el evento crudo del proveedor, genera/propaga
`requestId` desde `x-request-id` o `randomUUID()`, atrapa cualquier excepción y la traduce con
`toHttpError`) es el wiring común a cualquier entorno; lo que cambia entre un servidor Node local y
una Lambda es solo el `HttpRequestMapper` concreto (`@platform/adapter-node`/`@platform/adapter-aws`
los proveen ya armados vía `startLocalServer`/`createLambdaHandler`).

Un `UseCase` que lanza (o devuelve como `ApplicationResult` fallido) un error de `core` no necesita
traducirlo a mano — `toHttpError`/`toHttpResponse` ya conocen el mapeo:

| Error de `core`                          | `HttpError` (status)                                          |
| ---------------------------------------- | ------------------------------------------------------------- |
| `NotFoundError`                          | `NotFoundError` (404)                                         |
| `ValidationError`                        | `UnprocessableEntityError` (422)                              |
| `InvalidArgumentError`                   | `BadRequestError` (400)                                       |
| `UpstreamTimeoutError`                   | `GatewayTimeoutError` (504)                                   |
| `UpstreamServiceError`                   | `BadGatewayError` (502)                                       |
| `IntegrationMismatchError`               | `BadGatewayError` (502)                                       |
| cualquier otro (incl. `UnexpectedError`) | `InternalServerError` (500), sin reenviar el mensaje original |

Esta tabla es un contrato de datos entre servicios, no solo tipos — ver `CONTRIBUTING.md` antes de
cambiar a qué status mapea un `type` existente. `HttpError` también trae subclases propias para
construir a mano (`BadRequestError` 400, `UnauthorizedError` 401, `ForbiddenError` 403,
`NotFoundError` 404, `TimeoutError` 408, `ConflictError` 409, `UnprocessableEntityError` 422,
`InternalServerError` 500, `BadGatewayError` 502, `ServiceUnavailableError` 503,
`GatewayTimeoutError` 504).

`withHttpCache(handle, cache, { ttlSeconds?, keyBuilder? })` envuelve un `HttpRoute["handle"]` con
un read-through cache — por defecto solo cachea `GET` (dejá `keyBuilder` para cachear otros métodos
de forma segura) y solo guarda respuestas `2xx`.

## Mensajería (`messaging/`)

Eje async, simétrico al HTTP — `MessageEnvelope` normaliza el evento del proveedor (`id`, `source`,
`receivedAt`, `attributes`, `body`), igual que `HttpRequest` para HTTP:

```ts
// apps/processOrderPaidRoute.ts
import {
  bySource,
  withIdempotency,
  type IdempotencyStore,
  type MessageRoute,
} from "@platform/infrastructure";
import type { ProcessOrderPaid } from "../core/application/ProcessOrderPaid.js";

export const processOrderPaidRoute = (
  processOrderPaid: ProcessOrderPaid,
  idempotencyStore: IdempotencyStore,
  queueArn: string,
): MessageRoute => ({
  matches: bySource(queueArn),
  handle: withIdempotency(
    (envelope) => processOrderPaid.execute(envelope.body as { orderId: string }),
    idempotencyStore,
    { ttlSeconds: 60 * 60 * 24 },
  ),
});
```

`createMessageDispatcher(mapEnvelopes, routes, toProviderResult)` es el equivalente de
`createHttpDispatcher`: mapea el evento crudo a uno o más `MessageEnvelope`, corre la
`MessageRoute` que matchea cada uno (un envelope sin ruta se trata como fallo de ese ítem, no como
excepción que tira todo el batch), y deja que `toProviderResult` traduzca los resultados a lo que
el proveedor espera — `@platform/adapter-aws` lo usa para `createSqsMessageHandler`/
`createEventBridgeMessageHandler`. `withIdempotency(handle, store, { ttlSeconds?, keyBuilder? })` es
el mismo patrón que `withHttpCache` pero para deduplicar reentregas _at-least-once_: un hit
devuelve éxito sin re-ejecutar `handle`; un fallo no marca la key como procesada, para que la
próxima entrega pueda reintentar.

## Puertos (`ports/`)

| Puerto             | Implementación de referencia                                 | Uso                                                                                                                                             |
| ------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `RestClient`       | `NodeFetchRestClient` (`@platform/adapter-node`)             | Llamar un sistema externo por REST; ya distingue `UpstreamTimeoutError` de `UpstreamServiceError`.                                              |
| `EventBus`         | `InMemoryEventBus` (`@platform/adapter-node`)                | Publicar los eventos de dominio que devuelve `aggregate.pullDomainEvents()`.                                                                    |
| `Cache<T>`         | `RedisCache<T>` (`@platform/adapter-redis`)                  | Cachear cualquier valor serializable fuera del proceso; `HttpResponseCache`/`withHttpCache` son la variante especializada para respuestas HTTP. |
| `IdempotencyStore` | `InMemoryIdempotencyStore` (`@platform/testing`, solo tests) | Deduplicar el procesamiento de mensajes con reentrega _at-least-once_ (SQS/EventBridge) — ver `withIdempotency` arriba.                         |

Un puerto nuevo va acá salvo que `core/application` necesite invocarlo directo dentro de un
`UseCase.execute()` — en ese caso va en `core` (es el caso de `Logger`; ver SKILL.md § `Cache<T>`
para la regla completa).

## Consumo

```ts
import {
  HttpRouter,
  createHttpDispatcher,
  withHttpCache,
  type RestClient,
} from "@platform/infrastructure";
```

`"@platform/infrastructure": "workspace:*"` (o `file:../platform/packages/infrastructure`) — ver
[README raíz](../../README.md) § Instalación.
