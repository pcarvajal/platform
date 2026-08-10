import { DomainEvent, DomainEventSubscriber } from "@platform/core";

export interface EventBus {
  publish(events: Array<DomainEvent>): Promise<void>;
  addSubscribers(domainEventSubscribers: Array<DomainEventSubscriber>): void;
}
