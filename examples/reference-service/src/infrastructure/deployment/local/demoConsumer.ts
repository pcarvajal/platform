import { NodeConsoleLoggerClient } from "@platform/adapter-node";
import {
  createMessageDispatcher,
  type IdempotencyStore,
  type MessageDispatchResult,
  type MessageEnvelope,
} from "@platform/infrastructure";
import {
  processOrderPaidRoute,
  PROCESS_ORDER_PAID_SOURCE,
} from "../../../apps/processOrderPaidRoute.js";
import { ProcessOrderPaid } from "../../../core/application/ProcessOrderPaid.js";
import { Order } from "../../../core/domain/Order.js";
import { InMemoryOrderRepository } from "../../persistence/InMemoryOrderRepository.js";

// Doble mínimo solo para esta demo — InMemoryIdempotencyStore (@platform/testing) es
// devDependency, no corre en el runtime de un servicio real (ver references/testing.md).
class DemoIdempotencyStore implements IdempotencyStore {
  private readonly processed = new Set<string>();

  async hasProcessed(key: string): Promise<boolean> {
    return this.processed.has(key);
  }

  async markProcessed(key: string): Promise<void> {
    this.processed.add(key);
  }
}

const logger = new NodeConsoleLoggerClient();
const orderRepository = new InMemoryOrderRepository();
const idempotencyStore = new DemoIdempotencyStore();

// Sembrar una orden "created" para poder marcarla paid.
const order = Order.create("customer-1", ["sku-1"]);
await orderRepository.save(order);

const processOrderPaid = new ProcessOrderPaid(orderRepository, logger);
const routes = [processOrderPaidRoute(processOrderPaid, idempotencyStore)];

// mapEnvelopes es la identidad acá — no hay un evento nativo de proveedor (SQS/EventBridge) que
// mapear, ver @platform/adapter-aws para eso. Mismo createMessageDispatcher que usaría un
// createSqsMessageHandler real por dentro (ver references/eventos.md).
const dispatch = createMessageDispatcher(
  (envelopes: MessageEnvelope[]) => envelopes,
  routes,
  (results: MessageDispatchResult[]) => results,
);

const envelope: MessageEnvelope = {
  id: order.id.value,
  source: PROCESS_ORDER_PAID_SOURCE,
  receivedAt: new Date(),
  attributes: {},
  body: { orderId: order.id.value },
};

logger.info("Dispatching order-paid event (1st delivery)");
console.log(await dispatch([envelope]));

logger.info("Dispatching the SAME event again — simulates at-least-once redelivery");
console.log(await dispatch([envelope]));
