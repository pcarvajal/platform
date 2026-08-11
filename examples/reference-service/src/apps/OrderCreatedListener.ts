import type { DomainEventClass, DomainEventSubscriber, Logger } from "@platform/core";
import { OrderCreated } from "../core/domain/OrderCreated.js";

// Suscriptor en proceso — registrado contra un EventBus (InMemoryEventBus en este ejemplo, ver
// server.ts) para demostrar el flujo domain event → EventBus → subscriber sin broker externo.
export class OrderCreatedListener implements DomainEventSubscriber<OrderCreated> {
  constructor(private readonly logger: Logger) {}

  subscribedTo(): DomainEventClass[] {
    return [OrderCreated];
  }

  on(event: OrderCreated): void {
    this.logger.info("Order created", event.toScalars());
  }
}
