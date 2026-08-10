# @platform/adapter-node

Implementación de referencia de la plataforma para correr un servicio como servidor HTTP local con
Node — y, hasta hoy, la única implementación de los puertos de `@platform/infrastructure` que no
son específicos de HTTP (`RestClient`, `EventBus`, `Logger`), reutilizable también en `deployment/aws`
para lo que no depende de Lambda.

Referencia completa: ver [`company-platform/SKILL.md`](../../skills/company-platform/SKILL.md)
§ `infrastructure/deployment/`, tabla de primitivas HTTP.

## Qué provee

| Export                               | Implementa                                | Uso                                                                                                                                                                                                                              |
| ------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startLocalServer(routes, { port })` | —                                         | Empaqueta `HttpRouter` + `NodeHttpRequestMapper` + `createHttpDispatcher` + `NodeHttpServer.listen` en una sola llamada.                                                                                                         |
| `NodeHttpServer`                     | `HttpServer` (`@platform/infrastructure`) | Servidor `node:http` crudo; lo arma `startLocalServer`, rara vez se instancia a mano.                                                                                                                                            |
| `NodeHttpRequestMapper`              | `HttpRequestMapper<IncomingMessage>`      | Convierte un `IncomingMessage` de Node a `HttpRequest`.                                                                                                                                                                          |
| `NodeFetchRestClient`                | `RestClient`                              | Cliente REST sobre `fetch` nativo — sin dependencias de terceros. Traduce fallos de red/timeout/status no-2xx a `UpstreamServiceError`/`UpstreamTimeoutError` con `details` estructurados (`{ method, url, statusCode, body }`). |
| `InMemoryEventBus`                   | `EventBus`                                | Dispatcha eventos a los `DomainEventSubscriber` registrados, en el mismo proceso, sin broker — sirve tanto para `deployment/local` como para tests (también se reexporta desde `@platform/testing`).                             |
| `NodeConsoleLoggerClient`            | `Logger` (`@platform/core`)               | Logueo a `console.*`, con el enmascarado de campos sensibles ya aplicado.                                                                                                                                                        |

```ts
// infrastructure/deployment/local/server.ts
import { startLocalServer, InMemoryEventBus, NodeFetchRestClient } from "@platform/adapter-node";
import type { HttpRoute } from "@platform/infrastructure";

const eventBus = new InMemoryEventBus();
eventBus.addSubscribers([new OrderCreatedListener(/* ... */)]);

const restClient = new NodeFetchRestClient({
  baseURL: config.PAYMENTS_API_URL,
  defaultTimeoutMs: 5000,
});

const routes: HttpRoute[] = [/* ... */];
await startLocalServer(routes, { port: config.PORT });
```

Para un mapper o dispatcher distinto al default, compone `HttpRouter` + `createHttpDispatcher` a
mano en vez de `startLocalServer` — sigue siendo composición manual y explícita.

## Consumo

`"@platform/adapter-node": "workspace:*"` (o `file:../../platform/packages/adapters/node`) — ver
[README raíz](../../../README.md) § Instalación. Solo si el deployment target incluye un servidor
HTTP local; si el proyecto solo corre en Lambda, no hace falta.
