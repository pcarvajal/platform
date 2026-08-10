# @platform/testing

Dobles de test para los puertos de `@platform/core`/`@platform/infrastructure`, para que un
proyecto no reinvente un repositorio in-memory, un logger espiable o un cliente REST falso en cada
suite de tests. Pensado como `devDependency` — no lleva nada de esto a producción.

Referencia: [`company-platform/SKILL.md`](../skills/company-platform/SKILL.md) § `@platform/testing`.

## Qué provee

| Export                             | Doble de                                  | Uso                                                                                                                                                                                           |
| ---------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `InMemoryRepository<TId, TEntity>` | (repositorio propio del proyecto)         | Clase base `Map`-backed (`save`/`findById`/`findAll`/`delete`) — `class InMemoryOrderRepository extends InMemoryRepository<string, Order> {}` en vez de reescribir el `Map` en cada proyecto. |
| `FakeLogger`                       | `Logger` (`@platform/core`)               | Guarda las llamadas en vez de imprimirlas (`fakeLogger.calls.error`), con el mismo enmascarado de campos sensibles que un `Logger` real.                                                      |
| `InMemoryEventBus`                 | `EventBus` (`@platform/infrastructure`)   | Reexportado desde `@platform/adapter-node` — el mismo doble sirve para `deployment/local` y para tests.                                                                                       |
| `InMemoryCache<T>`                 | `Cache<T>` (`@platform/infrastructure`)   | `Map`-backed, sin TTL ni fallos — para testear un `UseCase` que depende de un `Cache<T>` sin necesitar Redis.                                                                                 |
| `FakeRestClient`                   | `RestClient` (`@platform/infrastructure`) | Registra cada llamada (`fakeRestClient.calls`) y las resuelve contra una cola de respuestas programadas (`respondWith`/`respondWithError`).                                                   |
| `buildHttpRequest(overrides?)`     | —                                         | Builder de `HttpRequest` con defaults razonables (`method: "GET"`, `headers: {}`, `rawBody: null`, ...) para tests de controllers.                                                            |

```ts
import { FakeRestClient, InMemoryCache, FakeLogger } from "@platform/testing";

const restClient = new FakeRestClient();
restClient.respondWith({ id: "ord_1", status: "paid" });

const cache = new InMemoryCache<Product>();
const logger = new FakeLogger();

const useCase = new CreateOrder(restClient, cache, logger);
const result = await useCase.execute(command);

expect(restClient.calls).toHaveLength(1);
expect(logger.calls.error).toHaveLength(0);
```

## Consumo

```json
{ "devDependencies": { "@platform/testing": "workspace:*" } }
```

(o `file:../platform/packages/testing`) — ver [README raíz](../../README.md) § Instalación.
