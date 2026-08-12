import { BaseUseCase, NotFoundError, type Logger } from "@platform/core";
import { OrderId, type OrderScalars } from "../domain/Order.js";
import type { OrderRepository } from "./OrderRepository.js";

export type GetOrderCommand = { orderId: string };

export class GetOrder extends BaseUseCase<GetOrderCommand, OrderScalars> {
  constructor(
    private readonly orderRepository: OrderRepository,
    logger?: Logger,
  ) {
    super(logger);
  }

  protected async handle(command: GetOrderCommand): Promise<OrderScalars> {
    const order = await this.orderRepository.findById(new OrderId(command.orderId));
    if (!order) throw new NotFoundError(`Order ${command.orderId} not found`);
    return order.toScalar();
  }
}
