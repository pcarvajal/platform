# example-reference-service

Servicio de referencia ejecutable: un pequeño servicio de Orders que combina los ejes de
`platform/SKILL.md` en un solo proyecto real (no solo snippets de documentación), tocando la mayor
cantidad posible de features de `@platform/*` sin requerir infraestructura real para levantarlo.

## Endpoints

| Método | Path                  | Caso de uso   | Qué muestra                                                                                           |
| ------ | --------------------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| POST   | `/orders`             | `CreateOrder` | `route()`, `parseJsonBody`, VOs de dominio (`Sku`) validando el body, domain event `OrderCreated`     |
| GET    | `/orders/:id`         | `GetOrder`    | `route()` + `parsePathParams`, cache HTTP opcional (`withHttpCache` + Redis)                          |
| GET    | `/orders`             | `ListOrders`  | Controller-clase manual, `parseQueryParams`, `EnumValueObject`, paginación (`ApiResponse`)            |
| POST   | `/orders/:id/ship`    | `ShipOrder`   | Controller-clase manual, errores de negocio propios mapeados a 409/422 a mano                         |
| GET    | `/reports/orders.csv` | `ListOrders`  | `ExportOrdersController` (clase con `handle`), respuesta no-JSON con headers propios, Lambda dedicada |

Más un consumer asíncrono (`ProcessOrderPaid`, vía `MessageRoute` + `withIdempotency`) para el
evento `order.paid`.

`apps/ExportOrdersController.ts` es el único controller-clase literal del ejemplo (una clase con
`handle(request)`, `references/usecase.md` § "Forma manual"): `route()` no alcanza porque siempre
pasa por `toHttpResponse`, que fija `application/json` y envuelve el resultado en `{ data }`,
mientras que este endpoint devuelve un CSV con `Content-Type`/`Content-Disposition`/`X-Total-Count`
propios. Es también el único que no se expone como `HttpRoute` en AWS: lo invoca su propia Lambda
(ver "Deployment targets").

## Dominio

`Order` (`AggregateRoot`) modela el ciclo de vida `created → paid → shipped`, con dos domain
events (`OrderCreated`, `OrderShipped`) y tres value objects: `Sku` (`PatternValueObject`, valida
el formato de cada item), `ShippedAt` (`DateValueObject`, no se puede enviar con fecha futura) y
`OrderStatusVO` (`EnumValueObject`, valida el filtro `?status=` de `GET /orders`). `Order.ship()`
usa un switch exhaustivo + `assertNever` para la única transición válida (`paid → shipped`).

Dos errores de negocio propios, cada uno extendiendo el punto de extensión que le corresponde (ver
`references/errores.md`):

- `OrderNotPaidError` (`DomainError`, en `core/domain`) — regla de la propia entidad.
- `OrderAlreadyShippedError` (`ApplicationError`, en `core/application`, ejemplo literal de
  `errores.md`) — decisión de orquestación de `ShipOrder`, no de la entidad.

Ninguno de los dos tiene mapeo HTTP por defecto en la librería (`toHttpResponse.ts` solo mapea 6
`ApplicationError` + `InvalidArgumentError`) — por eso `apps/shipOrderRoute.ts` es un
controller-clase manual (`references/usecase.md` § "Forma manual") que los traduce a
`UnprocessableEntityError`/`ConflictError` a mano con `matchApplicationResult`. En cambio, un fallo
del proveedor de envíos externo (`UpstreamServiceError`/`UpstreamTimeoutError`, lanzados por
`NodeFetchRestClient`) sí tiene mapeo por defecto (502/504) — `ShipOrder` no necesita ese mismo
tratamiento especial para ese caso.

## Integraciones opcionales

El proyecto arranca y sirve los cinco endpoints sin ninguna configurada — cada una se activa solo
si la variable correspondiente está seteada en `.env.local` (ver `src/infrastructure/env.ts`):

- `REDIS_URL` — `GET /orders/:id` cachea su respuesta en Redis (`RedisHttpResponseCache`,
  `@platform/adapter-redis`) vía `withHttpCache`.
- `SHIPPING_PROVIDER_URL` — `ShipOrder` notifica a este sistema tras despachar
  (`NodeFetchRestClient`, `@platform/adapter-node`, inyectado como el puerto `RestClient`).
- `ORDERS_PAID_QUEUE_ARN` — usado solo por el target AWS (ver abajo), no por
  `deployment/local`.

## Deployment targets

- **`infrastructure/deployment/local/`** — servidor HTTP nativo de Node
  (`@platform/adapter-node`, `startLocalServer`). `demoConsumer.ts` simula una redelivery
  _at-least-once_ del evento `order.paid` y muestra que `withIdempotency` evita reprocesarlo.
- **`infrastructure/deployment/aws/`** — mismos `apps/`/`core/` palabra por palabra
  (`references/composicion.md` § "Ejemplo end-to-end"), cableados con `@platform/adapter-aws`:
  `httpHandler.ts` (`createLambdaHandler` + `AWSLoggerClient`) y `orderPaidConsumer.ts`
  (`createSqsMessageHandler`, siguiendo `references/eventos.md` § "consumer SQS con
  idempotencia"). `exportOrdersHandler.ts` es una tercera Lambda, dedicada a un solo endpoint
  (`GET /reports/orders.csv`, otro timeout/memoria que el resto de la API): al no haber nada que
  rutear, compone a mano `AWSApiGatewayEventHttpMapper` + `createHttpDispatcher` contra
  `ExportOrdersController` en vez de usar `createLambdaHandler` (que arma un `HttpRouter`). El
  mismo controller entra por el router en `deployment/local/server.ts` — la clase no sabe en cuál
  de los dos vive. Sigue usando los repositorios/EventBus in-memory del demo — un deployment real
  reemplazaría eso por `DynamoDbRepository` (`@platform/adapter-aws`) y un `EventBus` respaldado en
  SNS/EventBridge, sin tocar `apps/` ni `core/`.

No incluye una demo del patrón Outbox (`references/eventos.md`) ni un consumer de EventBridge —
necesitan persistencia transaccional real (DynamoDB/Postgres) o quedan fuera del alcance de un
ejemplo in-memory ejecutable sin infraestructura; ambos están documentados en `references/eventos.md`.

## Tests

`src/**/*.test.ts` (vitest, config propia — `pnpm test` de la raíz del monorepo excluye
`examples/`, ver su `vitest.config.ts`) ejercitan los dobles de `@platform/testing`:
`InMemoryRepository`, `FakeLogger`, `FakeRestClient`, `InMemoryCache`, `InMemoryEventBus`,
`InMemoryIdempotencyStore`, `buildHttpRequest`, `buildMessageEnvelope`.

## Correr

```sh
pnpm install
cp .env.example .env.local   # APP_SERVICE_NAME/APP_ENVIRONMENT/APP_LOG_LEVEL son obligatorios, ver src/infrastructure/env.ts
pnpm run doctor          # confirma que src/ sigue la convención de SKILL.md, incluido el contexto de env.ts
pnpm run build           # tsc
pnpm test                # vitest run
pnpm run dev              # POST http://localhost:3000/orders { "customerId": "...", "items": ["SKU-1"] }
                           # GET  http://localhost:3000/orders/:id
                           # GET  http://localhost:3000/orders?page=1&pageSize=20&status=paid
                           # POST http://localhost:3000/orders/:id/ship
                           # GET  http://localhost:3000/reports/orders.csv?status=paid
pnpm run demo:consumer    # simula la entrega (y redelivery) del evento async order.paid
```
