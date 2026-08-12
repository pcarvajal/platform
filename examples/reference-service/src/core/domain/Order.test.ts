import { InvalidArgumentError } from "@platform/core";
import { describe, expect, it } from "vitest";
import { Order } from "./Order.js";
import { OrderCreated } from "./OrderCreated.js";
import { OrderNotPaidError } from "./OrderNotPaidError.js";
import { OrderShipped } from "./OrderShipped.js";

describe("Order", () => {
  it("records an OrderCreated event on create", () => {
    const order = Order.create("customer-1", ["SKU-1"]);

    const events = order.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(OrderCreated);
    expect(order.toScalar()).toEqual({
      id: order.id.value,
      customerId: "customer-1",
      items: ["SKU-1"],
      status: "created",
    });
  });

  it("pullDomainEvents empties the pending events", () => {
    const order = Order.create("customer-1", ["SKU-1"]);
    order.pullDomainEvents();
    expect(order.pullDomainEvents()).toHaveLength(0);
  });

  it("rejects a malformed SKU with the domain's own InvalidArgumentError", () => {
    expect(() => Order.create("customer-1", ["not a valid sku!"])).toThrow(InvalidArgumentError);
  });

  it.each(["created", "cancelled"] as const)(
    "refuses to ship an order that is %s, not paid",
    (status) => {
      const order = Order.fromScalars({
        id: crypto.randomUUID(),
        customerId: "customer-1",
        items: ["SKU-1"],
        status,
      });

      expect(() => order.ship()).toThrow(OrderNotPaidError);
    },
  );

  it("ships a paid order and records OrderShipped", () => {
    const order = Order.fromScalars({
      id: crypto.randomUUID(),
      customerId: "customer-1",
      items: ["SKU-1"],
      status: "paid",
    });

    order.ship();

    expect(order.isShipped()).toBe(true);
    const events = order.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(OrderShipped);
  });

  it("shipping an already-shipped order is a no-op at the entity level", () => {
    const order = Order.fromScalars({
      id: crypto.randomUUID(),
      customerId: "customer-1",
      items: ["SKU-1"],
      status: "shipped",
    });

    expect(() => order.ship()).not.toThrow();
    expect(order.pullDomainEvents()).toHaveLength(0);
  });
});
