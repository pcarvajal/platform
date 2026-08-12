import { UpstreamServiceError } from "@platform/core";
import { InMemoryEventBus, InMemoryRepository, FakeRestClient } from "@platform/testing";
import { describe, expect, it } from "vitest";
import { Order, type OrderId } from "../domain/Order.js";
import { ShipOrder } from "./ShipOrder.js";
import type { OrderRepository } from "./OrderRepository.js";

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

async function paidOrder(repository: TestOrderRepository): Promise<Order> {
  const order = Order.create("customer-1", ["SKU-1"]);
  order.pullDomainEvents();
  order.markAsPaid();
  await repository.save(order);
  return order;
}

describe("ShipOrder", () => {
  it("ships a paid order, publishes OrderShipped and notifies the shipping provider", async () => {
    const orderRepository = new TestOrderRepository();
    const order = await paidOrder(orderRepository);
    const shippingProviderClient = new FakeRestClient();
    shippingProviderClient.respondWith({ acknowledged: true });
    const shipOrder = new ShipOrder(
      orderRepository,
      new InMemoryEventBus(),
      shippingProviderClient,
    );

    const result = await shipOrder.execute({ orderId: order.id.value });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe("shipped");
    expect(shippingProviderClient.calls).toHaveLength(1);
    expect(shippingProviderClient.calls[0]?.params).toEqual({ orderId: order.id.value });
  });

  it("works without a shipping provider configured (optional dependency)", async () => {
    const orderRepository = new TestOrderRepository();
    const order = await paidOrder(orderRepository);
    const shipOrder = new ShipOrder(orderRepository, new InMemoryEventBus());

    const result = await shipOrder.execute({ orderId: order.id.value });

    expect(result.ok).toBe(true);
  });

  it("fails with OrderAlreadyShippedError on a retry, not with a generic error", async () => {
    const orderRepository = new TestOrderRepository();
    const order = await paidOrder(orderRepository);
    const shipOrder = new ShipOrder(orderRepository, new InMemoryEventBus());
    await shipOrder.execute({ orderId: order.id.value });

    const result = await shipOrder.execute({ orderId: order.id.value });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("OrderAlreadyShippedError");
  });

  it("fails with OrderNotPaidError when shipping an order that was never paid", async () => {
    const orderRepository = new TestOrderRepository();
    const order = Order.create("customer-1", ["SKU-1"]);
    await orderRepository.save(order);
    const shipOrder = new ShipOrder(orderRepository, new InMemoryEventBus());

    const result = await shipOrder.execute({ orderId: order.id.value });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("OrderNotPaidError");
  });

  it("propagates a shipping provider failure as the library's own UpstreamServiceError type", async () => {
    const orderRepository = new TestOrderRepository();
    const order = await paidOrder(orderRepository);
    const shippingProviderClient = new FakeRestClient();
    shippingProviderClient.respondWithError(
      new UpstreamServiceError("Shipping provider is down", { statusCode: 503 }),
    );
    const shipOrder = new ShipOrder(
      orderRepository,
      new InMemoryEventBus(),
      shippingProviderClient,
    );

    const result = await shipOrder.execute({ orderId: order.id.value });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Mapeado automáticamente por toApplicationFailure (@platform/core) y, en HTTP, a
    // BadGatewayError (502) por toHttpResponse.ts — sin necesitar el controller manual que
    // apps/shipOrderRoute.ts sí necesita para OrderAlreadyShippedError/OrderNotPaidError.
    expect(result.error.type).toBe("UpstreamServiceError");
  });
});
