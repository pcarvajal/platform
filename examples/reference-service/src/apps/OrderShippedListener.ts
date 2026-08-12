import type { DomainEventClass, DomainEventSubscriber, Logger } from "@platform/core";
import { OrderShipped } from "../core/domain/OrderShipped.js";

// Segundo suscriptor en proceso, simétrico a OrderCreatedListener — registrado contra el mismo
// EventBus (ver server.ts) para mostrar que un proyecto real normalmente tiene varios listeners,
// cada uno reaccionando a un evento de dominio distinto.
export class OrderShippedListener implements DomainEventSubscriber<OrderShipped> {
  constructor(private readonly logger: Logger) {}

  subscribedTo(): DomainEventClass[] {
    return [OrderShipped];
  }

  on(event: OrderShipped): void {
    this.logger.info("Order shipped", event.toScalars());
  }
}
