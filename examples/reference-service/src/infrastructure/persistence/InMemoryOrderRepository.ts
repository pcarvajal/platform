import type { OrderRepository } from "../../core/application/OrderRepository.js";
import type { Order, OrderId } from "../../core/domain/Order.js";

export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();

  async save(order: Order): Promise<void> {
    this.orders.set(order.id.value, order);
  }

  async findById(id: OrderId): Promise<Order | undefined> {
    return this.orders.get(id.value);
  }
}
