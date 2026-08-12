import { AWSLoggerClient, createLambdaHandler } from "@platform/adapter-aws";
import { InMemoryEventBus } from "@platform/adapter-node";
import type { HttpRoute } from "@platform/infrastructure";
import { createOrderRoute } from "../../../apps/createOrderRoute.js";
import { getOrderRoute } from "../../../apps/getOrderRoute.js";
import { listOrdersRoute } from "../../../apps/listOrdersRoute.js";
import { OrderCreatedListener } from "../../../apps/OrderCreatedListener.js";
import { OrderShippedListener } from "../../../apps/OrderShippedListener.js";
import { shipOrderRoute } from "../../../apps/shipOrderRoute.js";
import { CreateOrder } from "../../../core/application/CreateOrder.js";
import { GetOrder } from "../../../core/application/GetOrder.js";
import { ListOrders } from "../../../core/application/ListOrders.js";
import { ShipOrder } from "../../../core/application/ShipOrder.js";
import { InMemoryOrderRepository } from "../../persistence/InMemoryOrderRepository.js";
import { config } from "../../env.js";

// Mismo `apps/`/`core/` que deployment/local/server.ts, palabra por palabra — cambia el
// entorno, no el negocio (ver references/composicion.md § "Ejemplo end-to-end"): AWSLoggerClient
// en vez de NodeConsoleLoggerClient, createLambdaHandler en vez de startLocalServer.
//
// InMemoryOrderRepository/InMemoryEventBus siguen siendo dobles in-memory acá también — un Lambda
// real perdería todo su estado entre invocaciones con esto. Un deployment AWS real reemplazaría
// InMemoryOrderRepository por DynamoDbRepository (@platform/adapter-aws, ver
// references/eventos.md § Patrón Outbox) y el EventBus por uno respaldado en SNS/EventBridge —
// ninguno de los dos cambia una línea de apps/ ni de core/.
const logger = AWSLoggerClient.fromAppContext(config);
const orderRepository = new InMemoryOrderRepository();
const eventBus = new InMemoryEventBus();
eventBus.addSubscribers([new OrderCreatedListener(logger), new OrderShippedListener(logger)]);

const createOrder = new CreateOrder(orderRepository, eventBus, logger);
const getOrder = new GetOrder(orderRepository, logger);
const listOrders = new ListOrders(orderRepository, logger);
const shipOrder = new ShipOrder(orderRepository, eventBus, undefined, logger);

const routes: HttpRoute[] = [
  createOrderRoute(createOrder),
  getOrderRoute(getOrder),
  listOrdersRoute(listOrders),
  shipOrderRoute(shipOrder),
];

export const handler = createLambdaHandler(routes);
