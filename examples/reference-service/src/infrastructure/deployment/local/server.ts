import { RedisHttpResponseCache } from "@platform/adapter-redis";
import {
  InMemoryEventBus,
  NodeConsoleLoggerClient,
  startLocalServer,
} from "@platform/adapter-node";
import type { HttpResponseCache, HttpRoute, RestClient } from "@platform/infrastructure";
import { Redis } from "ioredis";
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
import { createShippingProviderClient } from "../../clients/rest/shippingProviderClient.js";
import { config } from "../../env.js";

const logger = new NodeConsoleLoggerClient();
const orderRepository = new InMemoryOrderRepository();
const eventBus = new InMemoryEventBus();
eventBus.addSubscribers([new OrderCreatedListener(logger), new OrderShippedListener(logger)]);

// Las dos integraciones de abajo son opcionales — ver env.ts. Ninguna hace falta para levantar el
// servidor ni para ejercitar los tres endpoints; si no están configuradas, este demo simplemente
// no cachea GET /orders/:id ni notifica a un proveedor de logística externo al enviar una orden.
let cache: HttpResponseCache | undefined;
if (config.REDIS_URL) {
  const redisClient = new Redis(config.REDIS_URL);
  cache = new RedisHttpResponseCache(redisClient, { logger });
  logger.info("GET /orders/:id will be cached in Redis", { ttlSeconds: 30 });
}

let shippingProviderClient: RestClient | undefined;
if (config.SHIPPING_PROVIDER_URL) {
  shippingProviderClient = createShippingProviderClient({ baseURL: config.SHIPPING_PROVIDER_URL });
  logger.info("ShipOrder will notify the shipping provider", {
    baseURL: config.SHIPPING_PROVIDER_URL,
  });
}

const createOrder = new CreateOrder(orderRepository, eventBus, logger);
const getOrder = new GetOrder(orderRepository, logger);
const listOrders = new ListOrders(orderRepository, logger);
const shipOrder = new ShipOrder(orderRepository, eventBus, shippingProviderClient, logger);

// El ruteo real vive acá — es lo único específico de este proyecto en este archivo (ver
// references/composicion.md § "Ejemplo end-to-end"). HttpRouter (usado por dentro de
// startLocalServer) recién importa cuando hay más de un endpoint, como acá.
const routes: HttpRoute[] = [
  createOrderRoute(createOrder),
  getOrderRoute(getOrder, cache),
  listOrdersRoute(listOrders),
  shipOrderRoute(shipOrder),
];

logger.info(
  `Starting ${config.APP_SERVICE_NAME} (${config.APP_ENVIRONMENT}) on port ${config.PORT}`,
);
await startLocalServer(routes, { port: config.PORT });
