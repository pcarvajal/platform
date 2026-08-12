import { DomainEvent } from "@platform/core";

export type OrderCreatedAttributes = { customerId: string; items: string[] };

export class OrderCreated extends DomainEvent<OrderCreatedAttributes> {
  static override readonly EVENT_NAME = "order.created";

  private constructor(
    aggregateId: string,
    private readonly attributes: OrderCreatedAttributes,
    eventId?: string,
    occurredOn?: Date,
  ) {
    super(OrderCreated.EVENT_NAME, aggregateId, eventId, occurredOn);
  }

  static create(aggregateId: string, attributes: OrderCreatedAttributes): OrderCreated {
    return new OrderCreated(aggregateId, attributes);
  }

  // El parámetro es `Record<string, unknown>` (no `OrderCreatedAttributes`) para que la firma
  // matchee la del static de la base (DomainEventAttributes = Record<string, unknown>,
  // contravariante en la posición de parámetro) — el cast interno confía en que quien reconstruye
  // el evento desde un stream/broker le pasa el shape correcto.
  static override fromScalars(
    aggregateId: string,
    eventId: string,
    occurredOn: Date,
    attributes: Record<string, unknown>,
  ): OrderCreated {
    return new OrderCreated(aggregateId, attributes as OrderCreatedAttributes, eventId, occurredOn);
  }

  toScalars(): OrderCreatedAttributes {
    return this.attributes;
  }
}
