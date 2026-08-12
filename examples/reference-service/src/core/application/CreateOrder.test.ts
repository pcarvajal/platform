import { InMemoryEventBus, InMemoryRepository, FakeLogger } from "@platform/testing";
import { describe, expect, it } from "vitest";
import { OrderCreated } from "../domain/OrderCreated.js";
import type { Order, OrderId } from "../domain/Order.js";
import { CreateOrder } from "./CreateOrder.js";
import type { OrderRepository } from "./OrderRepository.js";

// InMemoryRepository (@platform/testing) generaliza el Map<TId, TEntity> — se compone en vez de
// extenderse directo porque su TId es un string plano y OrderRepository pide OrderId (ver
// references/testing.md).
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

describe("CreateOrder", () => {
  it("persists the order and publishes OrderCreated to its subscribers", async () => {
    const orderRepository = new TestOrderRepository();
    const eventBus = new InMemoryEventBus();
    const received: OrderCreated[] = [];
    eventBus.addSubscribers([
      {
        subscribedTo: () => [OrderCreated],
        on: (event) => {
          received.push(event as OrderCreated);
        },
      },
    ]);
    const logger = new FakeLogger();
    const createOrder = new CreateOrder(orderRepository, eventBus, logger);

    const result = await createOrder.execute({ customerId: "customer-1", items: ["SKU-1"] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe("created");
    expect(await orderRepository.findAll()).toHaveLength(1);
    expect(received).toHaveLength(1);
    expect(logger.calls.error).toHaveLength(0);
  });

  it("returns a failed ApplicationResult (not a thrown error) for an invalid SKU", async () => {
    const orderRepository = new TestOrderRepository();
    const eventBus = new InMemoryEventBus();
    const logger = new FakeLogger();
    const createOrder = new CreateOrder(orderRepository, eventBus, logger);

    const result = await createOrder.execute({
      customerId: "customer-1",
      items: ["not a valid sku!"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("InvalidArgumentError");
    expect(logger.calls.error).toHaveLength(1);
  });
});
