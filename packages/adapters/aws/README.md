# @platform/adapter-aws

Implementación de referencia de la plataforma para AWS: Lambda detrás de API Gateway (eje HTTP),
Lambda detrás de SQS/EventBridge (eje mensajería), y persistencia en DynamoDB.

Referencia completa: ver [`platform/SKILL.md`](../../skills/platform/SKILL.md)
§ `infrastructure/deployment/`, tabla de primitivas HTTP, y
[`references/eventos.md`](../../skills/platform/references/eventos.md) para el eje de mensajería.

## HTTP — Lambda detrás de API Gateway

| Export                         | Implementa                                                          | Uso                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `createLambdaHandler(routes)`  | —                                                                   | Empaqueta `HttpRouter` + `AWSApiGatewayEventHttpMapper` + `createHttpDispatcher` en el handler que exporta el Lambda. |
| `AWSApiGatewayEventHttpMapper` | `HttpRequestMapper<APIGatewayProxyEvent \| APIGatewayProxyEventV2>` | Detecta automáticamente v1 vs v2 (`"rawPath" in event`) y normaliza a `HttpRequest`.                                  |

```ts
// infrastructure/deployment/aws/handler.ts
import { createLambdaHandler, AWSLoggerClient } from "@platform/adapter-aws";
import type { HttpRoute } from "@platform/infrastructure";

const logger = new AWSLoggerClient({ serviceName: "orders-api" });
const routes: HttpRoute[] = [/* ... */];

export const handler = createLambdaHandler(routes);
```

Un evento que no matchea ni v1 ni v2 de API Gateway (típico de un Lambda invocado por algo que no
es API Gateway, p. ej. un ALB o un invoke directo) se señala como `MalformedApiGatewayEventError`
(`AdapterError`), nunca como una excepción genérica.

Para un mapper o dispatcher distinto al default, compone `HttpRouter` + `createHttpDispatcher` a
mano en vez de `createLambdaHandler`.

## Mensajería — Lambda detrás de SQS / EventBridge

| Export                                    | Implementa                                                                                | Uso                                                                                                                                                                                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createSqsMessageHandler(routes)`         | `(routes: MessageRoute[]) => (event: SQSEvent) => Promise<SQSBatchResponse>`              | Empaqueta `mapSqsEvent` + `createMessageDispatcher` (`@platform/infrastructure`) + la traducción a `batchItemFailures` — un `ApplicationResult` con `ok: false` marca solo ese ítem como fallido, así que SQS reintenta/DLQ-ea únicamente ese mensaje, no todo el batch. |
| `mapSqsEvent(event)`                      | `(event: SQSEvent) => MessageEnvelope[]`                                                  | `source` es el `eventSourceARN` de la cola (lo que matchea `bySource` de una `MessageRoute`); `body` se parsea como JSON.                                                                                                                                                |
| `createEventBridgeMessageHandler(routes)` | `(routes: MessageRoute[]) => (event: EventBridgeEvent<string, unknown>) => Promise<void>` | A diferencia de SQS, EventBridge no tiene fallos parciales — un `ApplicationResult` con `ok: false` se traduce a una excepción (`EventBridgeDispatchError`) para que el retry nativo de Lambda actúe.                                                                    |
| `mapEventBridgeEvent(event)`              | `(event: EventBridgeEvent<string, unknown>) => MessageEnvelope[]`                         | Devuelve siempre un array de un elemento — EventBridge invoca el Lambda con un solo evento por invocación (a diferencia de SQS, que entrega en batch).                                                                                                                   |

```ts
// infrastructure/deployment/aws/orderPaidConsumer.ts
import { createSqsMessageHandler } from "@platform/adapter-aws";
import { processOrderPaidRoute } from "../../../apps/processOrderPaidRoute.js";
// ... wiring manual de ProcessOrderPaid + un IdempotencyStore real (Redis, DynamoDB, etc.)

export const handler = createSqsMessageHandler([
  processOrderPaidRoute(processOrderPaid, idempotencyStore, queueArn),
]);
```

Mismo patrón para EventBridge, cambiando `createSqsMessageHandler`/`mapSqsEvent` por
`createEventBridgeMessageHandler`/`mapEventBridgeEvent` y el `source` de la `MessageRoute` por el
`source` del evento en vez del ARN de una cola.

Un evento que no matchea la forma esperada (`SQSEvent`/`EventBridgeEvent`, o un body que no es JSON
válido en el caso de SQS) se señala como `MalformedSqsEventError`/`MalformedEventBridgeEventError`
(`AdapterError`), nunca como una excepción genérica.

## Persistencia — DynamoDB

| Export                                                         | Implementa | Uso                                                                                                                                                                                                                                       |
| -------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DynamoDbRepository<TId, TEntity>(client, { tableName, ... })` | —          | Base de repositorio de una tabla — `save`/`findById`/`findAll`/`delete`. Misma forma que `InMemoryRepository` (`@platform/testing`), así que un repositorio real y uno de test son intercambiables sin cambiar el código que los consume. |

```ts
// infrastructure/persistence/DynamoDbOrderRepository.ts
import { DynamoDbRepository } from "@platform/adapter-aws";
import { Order } from "../../core/domain/Order.js";
import type { OrderRepository } from "../../core/application/OrderRepository.js";

export class DynamoDbOrderRepository
  extends DynamoDbRepository<string, Order>
  implements OrderRepository
{
  protected toItem(order: Order) {
    return { id: order.id.value, customerId: order.customerId, items: order.items };
  }

  protected fromItem(item: Record<string, unknown>): Order {
    return Order.fromPersistence(item as { id: string; customerId: string; items: string[] });
  }
}
```

`findAll` usa `Scan`: es una base mínima de referencia para el caso común, no un framework de
single-table design — para una tabla grande o con GSIs, sobreescribir `findAll` con una `Query` en
la subclase en vez de depender del scan. Requiere un `DynamoDBDocumentClient` ya construido (no lo
crea) — quien compone `infrastructure/deployment/*` es responsable de instanciarlo.

## Logging

| Export                                                        | Implementa                  | Uso                                                                                                                                                            |
| ------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AWSLoggerClient({ serviceName, logLevel?, sensitiveKeys? })` | `Logger` (`@platform/core`) | Envuelve `@aws-lambda-powertools/logger`, con el enmascarado de campos sensibles de `Logger` ya aplicado sobre el `context` antes de pasarlo al logger de AWS. |

Válido en cualquiera de los tres ejes de arriba (HTTP, SQS, EventBridge) — es el mismo `Logger` que
recibe cada `UseCase`, no algo exclusivo del handler HTTP. `serviceName` es independiente de
`APP_SERVICE_NAME` del contexto de aplicación (`@platform/env`, ver
[`references/env.md`](../../skills/platform/references/env.md)) — lo natural es pasarle
`config.APP_SERVICE_NAME` en vez de repetir el nombre a mano:

```ts
import { AWSLoggerClient } from "@platform/adapter-aws";
import { config } from "../env.js";

const logger = new AWSLoggerClient({
  serviceName: config.APP_SERVICE_NAME,
  logLevel: config.APP_LOG_LEVEL,
});
```

## Consumo

`"@platform/adapter-aws": "workspace:*"` (o `file:../../platform/packages/adapters/aws`) — ver
[README raíz](../../../README.md) § Instalación. Solo si el deployment target es AWS Lambda /
API Gateway / SQS / EventBridge / DynamoDB.

Único paquete de la plataforma (junto con `@platform/adapter-redis`) con dependencias de terceros
en runtime, por diseño — ver `CLAUDE.md` § Conventions: `@aws-lambda-powertools/logger`,
`@aws-sdk/client-dynamodb` y `@aws-sdk/lib-dynamodb`, además de `@platform/core`/`@platform/infrastructure`.
`@types/aws-lambda` es `devDependency` (tipos de `SQSEvent`/`EventBridgeEvent`/`APIGatewayProxyEvent`,
no código en runtime).
