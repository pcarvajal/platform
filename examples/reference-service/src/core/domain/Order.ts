import { randomUUID } from "node:crypto";
import { AggregateRoot, Uuid, assertNever } from "@platform/core";
import { OrderCreated } from "./OrderCreated.js";
import { OrderNotPaidError } from "./OrderNotPaidError.js";
import { OrderShipped } from "./OrderShipped.js";
import { ShippedAt } from "./ShippedAt.js";
import { Sku } from "./Sku.js";

export class OrderId extends Uuid {}

export type OrderStatus = "created" | "paid" | "shipped" | "cancelled";

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
    readonly items: Sku[],
    status: OrderStatus,
  ) {
    super();
    this.status = status;
  }

  // `items` llega como string[] crudo desde el HTTP body (ver apps/createOrderRoute.ts) — cada uno
  // se valida acá como Sku; un formato inválido tira InvalidArgumentError (400 automático, ver
  // references/errores.md), sin que CreateOrder tenga que validarlo a mano.
  static create(customerId: string, items: string[]): Order {
    const order = new Order(
      new OrderId(randomUUID()),
      customerId,
      items.map((item) => new Sku(item)),
      "created",
    );
    order.record(OrderCreated.create(order.id.value, { customerId, items }));
    return order;
  }

  static fromScalars(scalars: OrderScalars): Order {
    return new Order(
      new OrderId(scalars.id),
      scalars.customerId,
      scalars.items.map((item) => new Sku(item)),
      scalars.status,
    );
  }

  markAsPaid(): void {
    this.status = "paid";
  }

  isShipped(): boolean {
    return this.status === "shipped";
  }

  // Único camino válido: paid -> shipped. El switch exhaustivo + assertNever (ver
  // references/dominio.md § assertNever) hace que agregar un quinto OrderStatus sin actualizar
  // esta lógica falle en compilación, no en runtime.
  ship(shippedAt: Date = new Date()): void {
    switch (this.status) {
      case "created":
      case "cancelled":
        throw new OrderNotPaidError(this.id.value, this.status);
      case "paid": {
        const validShippedAt = new ShippedAt(shippedAt);
        this.status = "shipped";
        this.record(OrderShipped.create(this.id.value, { shippedAt: validShippedAt.toString() }));
        return;
      }
      case "shipped":
        // Reenviar una orden ya enviada es un no-op a nivel de entidad — decidir si eso debería
        // ser un error de negocio (idempotencia de API) es responsabilidad de ShipOrder
        // (application), no de esta entidad. Ver core/application/OrderAlreadyShippedError.ts.
        return;
      default:
        assertNever(this.status);
    }
  }

  toScalar(): OrderScalars {
    return {
      id: this.id.value,
      customerId: this.customerId,
      items: this.items.map((sku) => sku.value),
      status: this.status,
    };
  }
}
