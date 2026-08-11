import { randomUUID } from "node:crypto";
import { AggregateRoot, Uuid } from "@platform/core";
import { OrderCreated } from "./OrderCreated.js";

export class OrderId extends Uuid {}

export type OrderStatus = "created" | "paid";

export type OrderScalars = {
  id: string;
  customerId: string;
  items: string[];
  status: OrderStatus;
};

export class Order extends AggregateRoot<OrderScalars> {
  private status: OrderStatus;

  private constructor(
    readonly id: OrderId,
    readonly customerId: string,
    readonly items: string[],
    status: OrderStatus,
  ) {
    super();
    this.status = status;
  }

  static create(customerId: string, items: string[]): Order {
    const order = new Order(new OrderId(randomUUID()), customerId, items, "created");
    order.record(OrderCreated.create(order.id.value, { customerId, items }));
    return order;
  }

  static fromScalars(scalars: OrderScalars): Order {
    return new Order(new OrderId(scalars.id), scalars.customerId, scalars.items, scalars.status);
  }

  markAsPaid(): void {
    this.status = "paid";
  }

  toScalar(): OrderScalars {
    return {
      id: this.id.value,
      customerId: this.customerId,
      items: this.items,
      status: this.status,
    };
  }
}
