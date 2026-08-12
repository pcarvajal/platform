import {
  buildMessageEnvelope,
  FakeLogger,
  InMemoryIdempotencyStore,
  InMemoryRepository,
} from "@platform/testing";
import { describe, expect, it } from "vitest";
import {
  ProcessOrderPaid,
  type ProcessOrderPaidCommand,
} from "../core/application/ProcessOrderPaid.js";
import type { OrderRepository } from "../core/application/OrderRepository.js";
import { Order, type OrderId } from "../core/domain/Order.js";
import { processOrderPaidRoute } from "./processOrderPaidRoute.js";

// apps/ no puede importar infrastructure/ (ver SKILL.md § Dirección de dependencias) — ni siquiera
// en un test co-ubicado, así que este double se apoya en InMemoryRepository (@platform/testing, un
// paquete externo) en vez de `../infrastructure/persistence/InMemoryOrderRepository.js` real.
class TestOrderRepository implements OrderRepository {
  private readonly repository = new (class extends InMemoryRepository<string, Order> {})();

  save(order: Order): Promise<void> {
    return this.repository.save(order);
  }
  findById(id: OrderId): Promise<Order | undefined> {
    return this.repository.findById(id.value);
  }
  findAll(): Promise<Order[]> {
    return this.repository.findAll();
  }
}

describe("processOrderPaidRoute", () => {
  it("marks the order as paid on the first delivery", async () => {
    const orderRepository = new TestOrderRepository();
    const order = Order.create("customer-1", ["SKU-1"]);
    await orderRepository.save(order);
    const processOrderPaid = new ProcessOrderPaid(orderRepository, new FakeLogger());
    const route = processOrderPaidRoute(processOrderPaid, new InMemoryIdempotencyStore());
    const envelope = buildMessageEnvelope<ProcessOrderPaidCommand>({
      source: "orders-paid-queue",
      body: { orderId: order.id.value },
    });

    const result = await route.handle(envelope);

    expect(result.ok).toBe(true);
    const persisted = await orderRepository.findById(order.id);
    expect(persisted?.toScalar().status).toBe("paid");
  });

  it("skips a redelivery of the same message instead of reprocessing it", async () => {
    const orderRepository = new TestOrderRepository();
    const order = Order.create("customer-1", ["SKU-1"]);
    await orderRepository.save(order);
    const logger = new FakeLogger();
    const processOrderPaid = new ProcessOrderPaid(orderRepository, logger);
    const route = processOrderPaidRoute(processOrderPaid, new InMemoryIdempotencyStore());
    // Mismo `id` en las dos entregas — bySource() + withIdempotency() (@platform/infrastructure)
    // usan `envelope.id` como key por defecto (ver references/eventos.md), simulando la redelivery
    // at-least-once de SQS/EventBridge.
    const envelope = buildMessageEnvelope<ProcessOrderPaidCommand>({
      source: "orders-paid-queue",
      body: { orderId: order.id.value },
    });

    await route.handle(envelope);
    logger.calls.info.length = 0;
    const secondDelivery = await route.handle(envelope);

    expect(secondDelivery.ok).toBe(true);
    // ProcessOrderPaid.handle nunca corrió una segunda vez — withIdempotency cortó antes, así que
    // no volvió a loguear "Marking order as paid".
    expect(logger.calls.info).toHaveLength(0);
  });
});
