import { BaseUseCase, type Logger } from "@platform/core";
import type { OrderScalars, OrderStatus } from "../domain/Order.js";
import type { OrderRepository } from "./OrderRepository.js";

export type ListOrdersCommand = { page: number; pageSize: number; status?: OrderStatus };
export type ListOrdersResult = { items: OrderScalars[]; total: number };

// No hay reglas de negocio en este caso de uso (solo lee y pagina) — es la aplicación "delgada"
// que estructura.md permite: apps/listOrdersRoute.ts arma el `pagination` de la respuesta, este
// UseCase solo devuelve `items` + `total`.
export class ListOrders extends BaseUseCase<ListOrdersCommand, ListOrdersResult> {
  constructor(
    private readonly orderRepository: OrderRepository,
    logger?: Logger,
  ) {
    super(logger);
  }

  protected async handle(command: ListOrdersCommand): Promise<ListOrdersResult> {
    const all = await this.orderRepository.findAll();
    const filtered = command.status
      ? all.filter((order) => order.toScalar().status === command.status)
      : all;

    const start = (command.page - 1) * command.pageSize;
    const items = filtered.slice(start, start + command.pageSize).map((order) => order.toScalar());

    return { items, total: filtered.length };
  }
}
