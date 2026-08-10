import type { DomainEvent, DomainEventSubscriber } from "@platform/core";
import type { EventBus } from "@platform/infrastructure";

/**
 * Reference EventBus for local development and tests: dispatches published events to whichever
 * subscribers declared them in `subscribedTo()`, in-process, with no broker. Swap for a real
 * broker-backed EventBus (SQS/SNS, Kafka...) once the project actually needs one across processes.
 */
export class InMemoryEventBus implements EventBus {
  private readonly subscribers: DomainEventSubscriber[] = [];

  addSubscribers(subscribers: DomainEventSubscriber[]): void {
    this.subscribers.push(...subscribers);
  }

  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      const matching = this.subscribers.filter((subscriber) =>
        subscriber.subscribedTo().some((eventClass) => eventClass.EVENT_NAME === event.eventName),
      );
      await Promise.all(matching.map((subscriber) => subscriber.on(event)));
    }
  }
}
