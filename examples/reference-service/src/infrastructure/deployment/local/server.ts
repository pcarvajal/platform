import {
  InMemoryEventBus,
  NodeConsoleLoggerClient,
  startLocalServer,
} from "@platform/adapter-node";
import type { HttpRoute } from "@platform/infrastructure";
import { createOrderRoute } from "../../../apps/createOrderRoute.js";
import { OrderCreatedListener } from "../../../apps/OrderCreatedListener.js";
import { CreateOrder } from "../../../core/application/CreateOrder.js";
import { InMemoryOrderRepository } from "../../persistence/InMemoryOrderRepository.js";
import { config } from "../../env.js";

const logger = new NodeConsoleLoggerClient();
const orderRepository = new InMemoryOrderRepository();
const eventBus = new InMemoryEventBus();
eventBus.addSubscribers([new OrderCreatedListener(logger)]);

const routes: HttpRoute[] = [createOrderRoute(new CreateOrder(orderRepository, eventBus, logger))];

logger.info(`Starting reference-service on port ${config.PORT}`);
await startLocalServer(routes, { port: config.PORT });
