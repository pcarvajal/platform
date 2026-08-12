import { BaseUseCase, NotFoundError, type Logger } from "@platform/core";
import { OrderId } from "../domain/Order.js";
import type { OrderRepository } from "./OrderRepository.js";

export type ProcessOrderPaidCommand = { orderId: string };

export class ProcessOrderPaid extends BaseUseCase<ProcessOrderPaidCommand, void> {
  constructor(
    private readonly orderRepository: OrderRepository,
    logger?: Logger,
  ) {
    super(logger);
  }

  protected async handle(command: ProcessOrderPaidCommand): Promise<void> {
    const order = await this.orderRepository.findById(new OrderId(command.orderId));
    if (!order) throw new NotFoundError(`Order ${command.orderId} not found`);

    // Logueado para que el demo de mensajería (demoConsumer.ts) pueda mostrar que una segunda
    // entrega del MISMO mensaje, vía withIdempotency, nunca llega hasta acá.
    this.logger?.info("Marking order as paid", { orderId: command.orderId });
    order.markAsPaid();
    await this.orderRepository.save(order);
  }
}
