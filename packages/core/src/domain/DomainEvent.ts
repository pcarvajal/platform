import { Uuid } from "./UuidValueObject.js";

export abstract class DomainEvent {
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

  abstract toScalars(): DomainEventAttributes;
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

type DomainEventAttributes = any;
