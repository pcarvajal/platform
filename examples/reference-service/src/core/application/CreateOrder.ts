import { BaseUseCase, type Logger } from "@platform/core";
import type { EventBus } from "@platform/infrastructure";
import { Order, type OrderScalars } from "../domain/Order.js";
import type { OrderRepository } from "./OrderRepository.js";

export type CreateOrderCommand = { customerId: string; items: string[] };

// EventBus (@platform/infrastructure) es un puerto, no infraestructura local — un UseCase puede
// depender de él directo (ver platform/references/http.md § "¿Dónde vive un puerto
// nuevo?"): lo que la dirección de dependencias prohíbe es importar el `src/infrastructure/`
// *propio* de este proyecto, no las interfaces de la librería.
export class CreateOrder extends BaseUseCase<CreateOrderCommand, OrderScalars> {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly eventBus: EventBus,
    logger?: Logger,
  ) {
    super(logger);
  }

  protected async handle(command: CreateOrderCommand): Promise<OrderScalars> {
    const order = Order.create(command.customerId, command.items);
    await this.orderRepository.save(order);
    // Ver references/eventos.md § Patrón Outbox para por qué esto NO es atómico con el `save` de
    // arriba, y cómo resolverlo en un proyecto real con persistencia transaccional.
    await this.eventBus.publish(order.pullDomainEvents());
    return order.toScalar();
  }
}
