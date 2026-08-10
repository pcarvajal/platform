import { Uuid } from "./UuidValueObject.js";

export abstract class DomainEvent<
  TAttributes extends DomainEventAttributes = DomainEventAttributes,
> {
  static EVENT_NAME: string;

  static fromScalars: (
    aggregateId: string,
    eventId: string,
    occurredOn: Date,
    attributes: DomainEventAttributes,
  ) => DomainEvent;

  protected constructor(
    readonly eventName: string,
    readonly aggregateId: string,
    readonly eventId?: string,
    readonly occurredOn?: Date,
  ) {
    this.aggregateId = aggregateId;
    this.eventId = eventId || Uuid.random().value;
    this.occurredOn = occurredOn || new Date();
    this.eventName = eventName;
  }

  abstract toScalars(): TAttributes;
}

export type DomainEventClass = {
  EVENT_NAME: string;
  fromScalars(
    aggregateId: string,
    eventId: string,
    occurredOn: Date,
    attributes: DomainEventAttributes,
  ): DomainEvent;
};

// Static members can't reference a class's own type parameters (a TS limitation, not a design
// choice) — `fromScalars`/`DomainEventClass` stay on this broader shape regardless of what a
// subclass's `toScalars()` narrows `TAttributes` to.
type DomainEventAttributes = Record<string, unknown>;
