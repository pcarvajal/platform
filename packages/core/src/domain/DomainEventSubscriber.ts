import { DomainEvent, DomainEventClass } from "./DomainEvent.js";

export interface DomainEventSubscriber<T extends DomainEvent = DomainEvent> {
  subscribedTo(): Array<DomainEventClass>;
  on(domainEvent: T): Promise<void> | void;
}
