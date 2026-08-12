# Eventos de dominio, `EventBus` y mensajería asíncrona (SQS/EventBridge)

> Referencia de `platform/SKILL.md`. Ver el índice para cuándo leer cada archivo de
> `references/`.

Este archivo cubre dos ejes relacionados pero distintos:

- **`DomainEvent`/`EventBus`** — pub/sub de eventos de dominio, en proceso, sin broker (lo que
  produce `AggregateRoot.pullDomainEvents()` tras persistir).
- **Mensajería asíncrona (`MessageRoute`/`createMessageDispatcher`)** — el eje de entrada
  equivalente a HTTP (ver [`http.md`](./http.md)) pero para eventos externos que llegan por SQS o
  EventBridge, con la misma simetría `mapper → dispatcher → ApplicationResult`.

## `DomainEvent` / `DomainEventSubscriber` (`packages/core/src/domain`)

| Clase                                                | Firma real                                                                                                                                                                                                                                                                                                                                 | Uso típico                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DomainEvent<TAttributes = Record<string, unknown>>` | `protected constructor(eventName, aggregateId, eventId?, occurredOn?)` — autogenera `eventId` (`Uuid.random()`) y `occurredOn` (`new Date()`) si no se pasan; cada subclase define `static EVENT_NAME`, `static fromScalars(...)` (para reconstruir el evento desde un stream/broker) y el método de instancia `toScalars(): TAttributes`. | `class OrderCreated extends DomainEvent<{ orderId: string }> { static override EVENT_NAME = 'order.created'; toScalars() { return { orderId: this.aggregateId }; } }` — `override` es obligatorio (`noImplicitOverride` en `tsconfig.base.json`); si la subclase también declara `static fromScalars(...)`, el parámetro `attributes` debe tiparse `Record<string, unknown>` (no el tipo angosto de `TAttributes`) y castear adentro — la firma del `static` de la base es contravariante en ese parámetro. Ver `examples/reference-service/src/core/domain/OrderCreated.ts` para el ejemplo completo que ya compila. |
| `DomainEventSubscriber<T>`                           | Interfaz: `subscribedTo(): DomainEventClass[]` + `on(event: T): Promise<void> \| void`.                                                                                                                                                                                                                                                    | La implementan los listeners que viven en `apps/` (p. ej. `OrderCreatedListener.ts`), registrados contra el `EventBus` del proyecto.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

Ver [`dominio.md`](./dominio.md) para `AggregateRoot.record(event)`/`pullDomainEvents()`, que es lo
que produce estos eventos antes de publicarlos.

## `EventBus` (`packages/infrastructure/src/ports/EventBus.ts`)

Interfaz: `publish(events: DomainEvent[]): Promise<void>` / `addSubscribers(subscribers:
DomainEventSubscriber[]): void`. Es lo que `apps/` cablea contra los `DomainEventSubscriber` del
proyecto, y lo que un caso de uso usa para publicar lo que `entity.pullDomainEvents()` devuelve tras
persistir.

Implementación de referencia: **`InMemoryEventBus`** (`@platform/adapter-node`) — dispatcha cada
evento publicado a los subscribers cuyo `subscribedTo()` incluya su `EVENT_NAME`, en el mismo
proceso, sin broker. Sirve tanto para `deployment/local` como para tests (también se reexporta desde
`@platform/testing`, ver [`testing.md`](./testing.md)). Cuando el proyecto necesite publicar eventos
entre procesos (colas, un broker real), se reemplaza por un `EventBus` propio contra ese sistema —
la interfaz no cambia, solo la implementación que se cablea en `deployment/*`.

```ts
// infrastructure/deployment/local/server.ts
import { InMemoryEventBus } from "@platform/adapter-node";

const eventBus = new InMemoryEventBus();
eventBus.addSubscribers([new OrderCreatedListener(/* ... */)]);
// ... pasar `eventBus` a los casos de uso que necesiten publicar eventos tras persistir.
```

## Mensajería asíncrona (`packages/infrastructure/src/messaging`)

Simétrico al eje HTTP (ver [`http.md`](./http.md)): un `MessageEnvelope` normalizado, una
`MessageRoute` por cola/tópico, y `createMessageDispatcher` como contraparte de
`createHttpDispatcher`.

| Clase/función                                                     | Firma real                                                                                                                                                                                                                                                                                                             | Uso típico                                                                                                                                                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MessageEnvelope<TBody>`                                          | Interfaz: `{ id, source, receivedAt, attributes, body: TBody }`.                                                                                                                                                                                                                                                       | Forma normalizada de un mensaje entrante; es lo que produce un mapper de proveedor (`mapSqsEvent`/`mapEventBridgeEvent`, adapter-aws) y lo que reciben las `MessageRoute` del proyecto. |
| `MessageRoute<TBody>`                                             | Interfaz: `{ matches(envelope), handle(envelope): Promise<ApplicationResult<unknown>> }`.                                                                                                                                                                                                                              | Una entrada por cola/tópico que el proyecto sabe procesar.                                                                                                                              |
| `bySource(source)`                                                | `(source: string) => MessageRoute["matches"]`. Matchea por `envelope.source` — forma por defecto, una ruta por cola/tópico.                                                                                                                                                                                            | `{ matches: bySource(queueArn), handle: (envelope) => processOrder.execute(envelope.body) }`.                                                                                           |
| `createMessageDispatcher(mapEnvelopes, routes, toProviderResult)` | `<TRawEvent, TRawResult>(mapEnvelopes, routes: MessageRoute[], toProviderResult: (results: MessageDispatchResult[]) => TRawResult) => (rawEvent: TRawEvent) => Promise<TRawResult>`. Un envelope sin ruta que lo maneje se reporta como fallo de ese ítem (`NotFoundError`), no como excepción que tira todo el batch. | Pieza que conecta `apps/` con `infrastructure/deployment/*` para el eje async, igual que `createHttpDispatcher` para HTTP.                                                              |
| `IdempotencyStore`                                                | Interfaz (`ports/IdempotencyStore.ts`): `hasProcessed(key): Promise<boolean>` / `markProcessed(key, ttlSeconds?): Promise<void>`.                                                                                                                                                                                      | SQS/EventBridge son _at-least-once_ — sin esto, todo proyecto reinventa su propia deduplicación. Implementación de referencia: `InMemoryIdempotencyStore` (`@platform/testing`).        |
| `withIdempotency(handle, store, options?)`                        | `(handle, store: IdempotencyStore, options?: { ttlSeconds?, keyBuilder? }) => typeof handle`. Envuelve un `MessageRoute["handle"]`: en un hit devuelve éxito sin ejecutar `handle`; en un miss lo ejecuta y solo marca la key si terminó en éxito.                                                                     | Composición manual sobre una `MessageRoute` puntual — mismo patrón que `withHttpCache` sobre una `HttpRoute`.                                                                           |
| `mapSqsEvent(event)` (adapter-aws)                                | `(event: SQSEvent) => MessageEnvelope[]`. `source` es el `eventSourceARN` de la cola; `body` se parsea como JSON. Lanza `MalformedSqsEventError` (`AdapterError`) si el evento o el body no matchean la forma esperada.                                                                                                | Mapper de referencia para consumers detrás de un trigger SQS.                                                                                                                           |
| `createSqsMessageHandler(routes)` (adapter-aws)                   | `(routes: MessageRoute[]) => (event: SQSEvent) => Promise<SQSBatchResponse>`. Empaqueta `mapSqsEvent` + `createMessageDispatcher` + la traducción a `batchItemFailures` — un `ApplicationResult` con `ok: false` marca solo ese ítem como fallido.                                                                     | `export const handler = createSqsMessageHandler(routes);` — SQS reintenta/DLQ-ea únicamente los ítems fallidos, no el batch completo.                                                   |
| `mapEventBridgeEvent(event)` (adapter-aws)                        | `(event: EventBridgeEvent<string, unknown>) => MessageEnvelope[]`. Devuelve siempre un array de un elemento (EventBridge invoca con un solo evento por invocación).                                                                                                                                                    | Mapper de referencia para consumers detrás de una regla de EventBridge.                                                                                                                 |
| `createEventBridgeMessageHandler(routes)` (adapter-aws)           | `(routes: MessageRoute[]) => (event: EventBridgeEvent<string, unknown>) => Promise<void>`. A diferencia de SQS, EventBridge no tiene fallos parciales — un `ApplicationResult` con `ok: false` se traduce a una excepción (`EventBridgeDispatchError`) para que el retry nativo actúe.                                 | `export const handler = createEventBridgeMessageHandler(routes);`                                                                                                                       |

### Ejemplo: consumer SQS con idempotencia

```ts
// apps/processOrderPaidRoute.ts
import { bySource, withIdempotency, type MessageRoute } from "@platform/infrastructure";
import type { IdempotencyStore } from "@platform/infrastructure";
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

```ts
// infrastructure/deployment/aws/orderPaidConsumer.ts
import { createSqsMessageHandler } from "@platform/adapter-aws";
import { processOrderPaidRoute } from "../../../apps/processOrderPaidRoute.js";
// ... wiring manual de ProcessOrderPaid + un IdempotencyStore real (Redis, DynamoDB, etc.)

export const handler = createSqsMessageHandler([
  processOrderPaidRoute(processOrderPaid, idempotencyStore, queueArn),
]);
```

`ProcessOrderPaid` sigue siendo un `UseCase`/`BaseUseCase` normal (ver
[`usecase.md`](./usecase.md)) — el eje de mensajería solo cambia cómo entra el comando, no cómo se
orquesta el caso de uso.

## Patrón Outbox (documentado, no un puerto de librería — todavía)

**El problema.** `entity.record(event)` + `entity.pullDomainEvents()` + `EventBus.publish(events)`
(ver arriba) no es atómico con guardar la entidad: si el proceso muere entre `repository.save(entity)`
y `eventBus.publish(events)`, el cambio queda persistido pero el evento nunca se publica — el
clásico problema de _dual write_. El patrón Outbox lo resuelve escribiendo el evento pendiente en la
**misma transacción** que la entidad, y publicándolo después en un paso separado que sí puede
reintentar sin perder nada.

> **Por qué esto es un patrón documentado con snippet y no un `OutboxRepository`/`OutboxRelay` de
> `@platform/infrastructure` todavía:** ver SKILL.md § "Cuándo SÍ/NO crear una abstracción" —
> aplicado acá literalmente. Este monorepo no tiene hoy un segundo consumidor real del patrón; la
> forma exacta de "misma transacción que la entidad" depende del motor de persistencia (DynamoDB
> `TransactWriteCommand`, una transacción de Postgres, etc.), así que fijar una interfaz ahora
> sería adivinar el contrato antes de tener el segundo caso real que lo justifique. Cuando un
> proyecto real lo implemente de forma independiente — la señal que el propio repo ya usa para
> promover algo a `infrastructure` —, ese es el momento de extraerlo.

### Forma del patrón

1. **`OutboxEntry`** — lo que se persiste junto a la entidad: `{ id, eventName, payload, occurredAt, publishedAt? }`.
   `publishedAt` ausente/`null` significa "pendiente".
2. **Escritura transaccional** — el `UseCase` guarda la entidad y sus `OutboxEntry` pendientes en
   la misma operación atómica.
3. **`OutboxRelay`** — un proceso separado (cron, o un consumer de `DynamoDB Streams`/CDC) que lee
   entradas pendientes, llama `EventBus.publish`, y solo marca `publishedAt` tras éxito — un fallo
   de publicación deja la entrada pendiente para el próximo intento, en vez de perder el evento.

### Ejemplo (DynamoDB, `TransactWriteCommand`)

```ts
// infrastructure/persistence/DynamoDbOrderRepository.ts
import { TransactWriteCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Order } from "../../core/domain/Order.js";

export class DynamoDbOrderRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  // Guarda la entidad y sus domain events pendientes (pullDomainEvents(), ver dominio.md) en una
  // sola transacción — o se persisten los dos, o ninguno.
  async save(order: Order): Promise<void> {
    const events = order.pullDomainEvents();
    await this.client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.tableName,
              Item: { pk: `ORDER#${order.id.value}`, ...order.toScalar() },
            },
          },
          ...events.map((event) => ({
            Put: {
              TableName: this.tableName,
              Item: {
                pk: `OUTBOX#${event.eventId.value}`,
                eventName: event.eventName,
                payload: event.toScalars(),
                occurredAt: event.occurredOn.toISOString(),
                // sin publishedAt — pendiente
              },
            },
          })),
        ],
      }),
    );
  }
}
```

```ts
// infrastructure/deployment/aws/outboxRelay.ts — cron separado, no el mismo Lambda que sirve HTTP
import { QueryCommand, UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export async function relayOutbox(
  client: DynamoDBDocumentClient,
  tableName: string,
  eventBus: EventBus,
) {
  const pending = await client.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "begins_with(pk, :prefix)",
      FilterExpression: "attribute_not_exists(publishedAt)",
      ExpressionAttributeValues: { ":prefix": "OUTBOX#" },
    }),
  );

  for (const item of pending.Items ?? []) {
    await eventBus.publish([DomainEventFromOutboxItem(item)]); // reconstruir vía DomainEvent.fromScalars
    await client.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { pk: item.pk },
        UpdateExpression: "SET publishedAt = :now",
        ExpressionAttributeValues: { ":now": new Date().toISOString() },
      }),
    );
  }
}
```

Si `eventBus.publish` falla a mitad del loop, las entradas ya publicadas quedan marcadas y las
restantes se reintentan en la próxima corrida — ninguna se pierde ni se publica dos veces salvo que
el propio `EventBus`/consumer no sea idempotente (ver `withIdempotency` arriba).
