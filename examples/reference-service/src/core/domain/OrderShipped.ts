import { DomainEvent } from "@platform/core";

export type OrderShippedAttributes = { shippedAt: string };

export class OrderShipped extends DomainEvent<OrderShippedAttributes> {
  static override readonly EVENT_NAME = "order.shipped";

  private constructor(
    aggregateId: string,
    private readonly attributes: OrderShippedAttributes,
    eventId?: string,
    occurredOn?: Date,
  ) {
    super(OrderShipped.EVENT_NAME, aggregateId, eventId, occurredOn);
  }

  static create(aggregateId: string, attributes: OrderShippedAttributes): OrderShipped {
    return new OrderShipped(aggregateId, attributes);
  }

  // Ver OrderCreated.ts para por qué `attributes` es `Record<string, unknown>` acá (contravarianza
  // del `static fromScalars` de la base) en vez de `OrderShippedAttributes`.
  static override fromScalars(
    aggregateId: string,
    eventId: string,
    occurredOn: Date,
    attributes: Record<string, unknown>,
  ): OrderShipped {
    return new OrderShipped(aggregateId, attributes as OrderShippedAttributes, eventId, occurredOn);
  }

  toScalars(): OrderShippedAttributes {
    return this.attributes;
  }
}
