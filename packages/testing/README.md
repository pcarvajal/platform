# @platform/testing

Dobles de test para los puertos de `@platform/core`/`@platform/infrastructure`, para que un
proyecto no reinvente un repositorio in-memory, un logger espiable o un cliente REST falso en cada
suite de tests. Pensado como `devDependency` — no lleva nada de esto a producción.

Referencia: [`platform/SKILL.md`](../skills/platform/SKILL.md) § `@platform/testing`.

## Qué provee

| Export                             | Doble de                                        | Uso                                                                                                                                                                                                                       |
| ---------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `InMemoryRepository<TId, TEntity>` | (repositorio propio del proyecto)               | Clase base `Map`-backed (`save`/`findById`/`findAll`/`delete`) — `class InMemoryOrderRepository extends InMemoryRepository<string, Order> {}` en vez de reescribir el `Map` en cada proyecto.                             |
| `FakeLogger`                       | `Logger` (`@platform/core`)                     | Guarda las llamadas en vez de imprimirlas (`fakeLogger.calls.error`), con el mismo enmascarado de campos sensibles que un `Logger` real.                                                                                  |
| `InMemoryEventBus`                 | `EventBus` (`@platform/infrastructure`)         | Reexportado desde `@platform/adapter-node` — el mismo doble sirve para `deployment/local` y para tests.                                                                                                                   |
| `InMemoryCache<T>`                 | `Cache<T>` (`@platform/infrastructure`)         | `Map`-backed, sin TTL ni fallos — para testear un `UseCase` que depende de un `Cache<T>` sin necesitar Redis.                                                                                                             |
| `FakeRestClient`                   | `RestClient` (`@platform/infrastructure`)       | Registra cada llamada (`fakeRestClient.calls`) y las resuelve contra una cola de respuestas programadas (`respondWith`/`respondWithError`); tira si se agota la cola sin haber programado una respuesta para esa llamada. |
| `InMemoryIdempotencyStore`         | `IdempotencyStore` (`@platform/infrastructure`) | `Set`-backed, sin TTL — para testear `withIdempotency`/un `MessageRoute` sin necesitar Redis/DynamoDB reales.                                                                                                             |
| `buildHttpRequest(overrides?)`     | —                                               | Builder de `HttpRequest` con defaults razonables (`method: "GET"`, `headers: {}`, `rawBody: null`, ...) para tests de controllers.                                                                                        |
| `buildMessageEnvelope(overrides?)` | —                                               | Builder de `MessageEnvelope` con defaults razonables (`source: "test-source"`, `attributes: {}`, ...) para tests de un `MessageRoute`/consumer — mismo rol que `buildHttpRequest` para el eje de mensajería.              |

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

Mismo enfoque para el eje de mensajería — testear un `MessageRoute` con `withIdempotency` sin un
store real:

```ts
import { InMemoryIdempotencyStore, buildMessageEnvelope } from "@platform/testing";

const idempotencyStore = new InMemoryIdempotencyStore();
const envelope = buildMessageEnvelope({ body: { orderId: "ord_1" } });

const first = await processOrderPaidRoute.handle(envelope);
const redelivery = await processOrderPaidRoute.handle(envelope); // misma entrega, 2da vez

expect(first.ok).toBe(true);
expect(redelivery.ok).toBe(true); // idempotente: no vuelve a ejecutar el UseCase
```

## Consumo

```json
{ "devDependencies": { "@platform/testing": "workspace:*" } }
```

(o `file:../platform/packages/testing`) — ver [README raíz](../../README.md) § Instalación.

`@platform/adapter-node` es `dependency` (no `devDependency`) de este paquete — de ahí sale el
`InMemoryEventBus` reexportado arriba — así que queda como dependencia transitiva de cualquier
proyecto que instale `@platform/testing`. Sin costo real: `adapter-node` no tiene dependencias de
terceros en runtime (ver su propio README).
