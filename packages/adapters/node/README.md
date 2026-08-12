# @platform/adapter-node

Implementación de referencia de la plataforma para correr un servicio como servidor HTTP local con
Node — y la única implementación de referencia de los puertos no específicos de HTTP de
`@platform/infrastructure` (`RestClient`, `EventBus`), reutilizable también en `deployment/aws` para
lo que no depende de Lambda. También trae una implementación de `Logger` (`@platform/core`,
`NodeConsoleLoggerClient`) — no la única: `AWSLoggerClient` (`@platform/adapter-aws`) es la
contraparte para Lambda.

Referencia completa: ver [`platform/SKILL.md`](../../skills/platform/SKILL.md)
§ `infrastructure/deployment/`, tabla de primitivas HTTP.

## Qué provee

| Export                               | Implementa                                | Uso                                                                                                                                                                                                                              |
| ------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startLocalServer(routes, { port })` | —                                         | Empaqueta `HttpRouter` + `NodeHttpRequestMapper` + `createHttpDispatcher` + `NodeHttpServer.listen` en una sola llamada.                                                                                                         |
| `NodeHttpServer`                     | `HttpServer` (`@platform/infrastructure`) | Servidor `node:http` crudo; lo arma `startLocalServer`, rara vez se instancia a mano.                                                                                                                                            |
| `NodeHttpRequestMapper`              | `HttpRequestMapper<IncomingMessage>`      | Convierte un `IncomingMessage` de Node a `HttpRequest`.                                                                                                                                                                          |
| `NodeFetchRestClient`                | `RestClient`                              | Cliente REST sobre `fetch` nativo — sin dependencias de terceros. Traduce fallos de red/timeout/status no-2xx a `UpstreamServiceError`/`UpstreamTimeoutError` con `details` estructurados (`{ method, url, statusCode, body }`). |
| `InMemoryEventBus`                   | `EventBus`                                | Dispatcha eventos a los `DomainEventSubscriber` registrados, en el mismo proceso, sin broker — sirve tanto para `deployment/local` como para tests (también se reexporta desde `@platform/testing`).                             |
| `NodeConsoleLoggerClient`            | `Logger` (`@platform/core`)               | Logueo a `console.*`, con el enmascarado de campos sensibles ya aplicado y filtrado por nivel si se construye con uno (`NodeConsoleLoggerClient.fromAppContext(config)`).                                                        |

```ts
// infrastructure/deployment/local/server.ts
import {
  startLocalServer,
  InMemoryEventBus,
  NodeFetchRestClient,
  NodeConsoleLoggerClient,
} from "@platform/adapter-node";
import type { HttpRoute } from "@platform/infrastructure";
import { config } from "../../env.js";

const logger = NodeConsoleLoggerClient.fromAppContext(config);
const eventBus = new InMemoryEventBus();
eventBus.addSubscribers([new OrderCreatedListener(logger)]);

const restClient = new NodeFetchRestClient({
  baseURL: config.PAYMENTS_API_URL,
  defaultTimeoutMs: 5000,
});

const routes: HttpRoute[] = [/* ... */];
logger.info(
  `Starting ${config.APP_SERVICE_NAME} (${config.APP_ENVIRONMENT}) on port ${config.PORT}`,
);
await startLocalServer(routes, { port: config.PORT });
```

`config` viene de `infrastructure/env.ts`, que sobre esta convención declara el contexto de
aplicación obligatorio con `env.appContext` (`@platform/env`, ver
[`references/env.md`](../../skills/platform/references/env.md)) — de ahí salen
`APP_SERVICE_NAME`/`APP_ENVIRONMENT`, además de `PORT`/`PAYMENTS_API_URL` propios del proyecto.

`NodeConsoleLoggerClient.fromAppContext(config)` es la forma recomendada de construirlo: aplica
`APP_LOG_LEVEL` del contexto de aplicación, así que con `APP_LOG_LEVEL=warn` los `logger.info`/
`logger.debug` del proyecto no se imprimen. El constructor directo sigue existiendo
(`new NodeConsoleLoggerClient(sensitiveKeys?, level?)`) y **sin nivel no filtra nada** — imprime
cualquier nivel que se le pase, igual que antes. Solo usa `APP_LOG_LEVEL` del contexto: `console.*`
no tiene dónde poner el nombre del servicio sin cambiar el formato de línea (`[INFO] mensaje`), a
diferencia de `AWSLoggerClient`, que sí lo emite como campo estructurado.

Las líneas `[local] HTTP server listening…` que imprime `NodeHttpServer` al arrancar salen de
`console.info` directo, no del `Logger` — no las afecta `APP_LOG_LEVEL`.

Para un mapper o dispatcher distinto al default, compone `HttpRouter` + `createHttpDispatcher` a
mano en vez de `startLocalServer` — sigue siendo composición manual y explícita. `startLocalServer`
devuelve el `NodeHttpServer` ya escuchando (`Promise<NodeHttpServer>`), útil para cerrarlo a mano
(`server.close()`) en un test de integración o un shutdown controlado.

## Consumo

`"@platform/adapter-node": "workspace:*"` (o `file:../../platform/packages/adapters/node`) — ver
[README raíz](../../../README.md) § Instalación. Solo si el deployment target incluye un servidor
HTTP local; si el proyecto solo corre en Lambda, no hace falta.

Sin dependencias de terceros en runtime (solo `@platform/core`/`@platform/infrastructure`,
`fetch`/`node:http` nativos) — `@types/node` es `devDependency`, no código en runtime.
