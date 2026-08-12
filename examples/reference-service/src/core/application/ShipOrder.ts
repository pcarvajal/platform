import { BaseUseCase, NotFoundError, type Logger } from "@platform/core";
import type { EventBus, RestClient } from "@platform/infrastructure";
import { OrderId, type OrderScalars } from "../domain/Order.js";
import { OrderAlreadyShippedError } from "./OrderAlreadyShippedError.js";
import type { OrderRepository } from "./OrderRepository.js";

export type ShipOrderCommand = { orderId: string };

export class ShipOrder extends BaseUseCase<ShipOrderCommand, OrderScalars> {
  // `shippingProviderClient` es opcional a propósito — ver
  // infrastructure/clients/rest/shippingProviderClient.ts y SHIPPING_PROVIDER_URL en env.ts: sin
  // esa var configurada, ShipOrder sigue funcionando (envía sin notificar a nadie afuera), en vez
  // de fallar el caso de uso completo por una integración que en local/tests no existe.
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly eventBus: EventBus,
    private readonly shippingProviderClient?: RestClient,
    logger?: Logger,
  ) {
    super(logger);
  }

  protected async handle(command: ShipOrderCommand): Promise<OrderScalars> {
    const order = await this.orderRepository.findById(new OrderId(command.orderId));
    if (!order) throw new NotFoundError(`Order ${command.orderId} not found`);

    // Chequeo de orquestación (no de la entidad, ver core/domain/Order.ts#ship): decide qué error
    // de negocio devolver ante un reintento sobre una orden ya enviada.
    if (order.isShipped()) throw new OrderAlreadyShippedError(order.id.value);

    order.ship();
    await this.orderRepository.save(order);
    await this.eventBus.publish(order.pullDomainEvents());

    // UpstreamServiceError/UpstreamTimeoutError (lanzados por NodeFetchRestClient — ver
    // references/errores.md) ya están mapeados a 502/504 en toHttpResponse.ts, a diferencia de
    // OrderAlreadyShippedError arriba — este caso no necesita traducción manual en
    // apps/shipOrderRoute.ts.
    if (this.shippingProviderClient) {
      await this.shippingProviderClient.post("/shipments", { orderId: order.id.value });
    }

    return order.toScalar();
  }
}
