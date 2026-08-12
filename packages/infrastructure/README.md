# @platform/infrastructure

Primitivas HTTP y los "puertos" (interfaces tecnología-agnósticas, implementadas por un adapter
concreto) que el resto de la plataforma usa para hablar con el exterior: `RestClient`, `EventBus`,
`Cache<T>`. Depende solo de `@platform/core`.

Referencia completa (firmas exactas, tabla de mapeo HTTP, ejemplo end-to-end): ver
[`platform/SKILL.md`](../skills/platform/SKILL.md) § `infrastructure/`.

## Estructura interna

```
src/
├── http/    HttpRequest, HttpResponse, HttpRouter, HttpError + subclases, createHttpDispatcher,
│            toHttpResponse/toHttpError, withHttpCache, validateRequest, HttpRequestMapper...
└── ports/   RestClient, EventBus, Cache<T>, ApiResponse — contratos sin implementación propia;
             cada uno tiene una implementación de referencia en un adapter (`@platform/adapter-node`,
             `@platform/adapter-redis`).
```

## HTTP

```ts
// apps/CreateOrderController.ts
import {
  parseJsonBody,
  toHttpResponse,
  type HttpRequest,
  type HttpResponse,
} from "@platform/infrastructure";

export class CreateOrderController {
  constructor(private readonly createOrder: CreateOrder) {}
  async handle(request: HttpRequest): Promise<HttpResponse> {
    const body = parseJsonBody(request, CreateOrderBody);
    const result = await this.createOrder.execute(body);
    return toHttpResponse(result, { successStatusCode: 201 });
  }
}
```

`HttpRoute[]` + `HttpRouter` + `createHttpDispatcher` es el wiring común a cualquier entorno; lo que
cambia entre un servidor Node local y una Lambda es solo el `HttpRequestMapper` concreto
(`@platform/adapter-node`/`@platform/adapter-aws` los proveen ya armados vía
`startLocalServer`/`createLambdaHandler`). Un `UseCase` que lanza un error de `core`
(`NotFoundError`, `ValidationError`, etc.) no necesita traducirlo a mano — `toHttpError`/
`toHttpResponse` ya conocen el mapeo a `HttpError` (`BadRequestError`, `NotFoundError`,
`UnprocessableEntityError`, `BadGatewayError`, `GatewayTimeoutError`, `InternalServerError`, ...).

## Puertos (`ports/`)

| Puerto       | Implementación de referencia                     | Uso                                                                                                                                             |
| ------------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `RestClient` | `NodeFetchRestClient` (`@platform/adapter-node`) | Llamar un sistema externo por REST; ya distingue `UpstreamTimeoutError` de `UpstreamServiceError`.                                              |
| `EventBus`   | `InMemoryEventBus` (`@platform/adapter-node`)    | Publicar los eventos de dominio que devuelve `aggregate.pullDomainEvents()`.                                                                    |
| `Cache<T>`   | `RedisCache<T>` (`@platform/adapter-redis`)      | Cachear cualquier valor serializable fuera del proceso; `HttpResponseCache`/`withHttpCache` son la variante especializada para respuestas HTTP. |

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
