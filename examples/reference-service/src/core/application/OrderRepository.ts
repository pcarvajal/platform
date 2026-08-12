import type { Order, OrderId } from "../domain/Order.js";

export interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Order | undefined>;
  findAll(): Promise<Order[]>;
}
