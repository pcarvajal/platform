import { DomainError } from "@platform/core";
import type { OrderStatus } from "./Order.js";

// Regla de dominio propia de Order.ship(): solo se puede pasar de "paid" a "shipped". Sin mapeo en
// HTTP_ERROR_BY_APPLICATION_ERROR_TYPE (infrastructure/http/toHttpResponse.ts) — cae en 500 vía el
// fallback genérico salvo que un controller la traduzca a mano, exactamente lo que hace
// apps/shipOrderRoute.ts (ver references/errores.md § "Mapeo a HTTP de los errores de domain").
export class OrderNotPaidError extends DomainError {
  readonly type = "OrderNotPaidError";

  // `orderId`/`status` quedan en `toScalars().data` solos, por nombre de propiedad (ver
  // references/errores.md) — no hace falta además pasarlos como `details`, eso duplicaría la
  // misma información dos veces en el mismo objeto.
  constructor(
    readonly orderId: string,
    readonly status: OrderStatus,
  ) {
    super(`Order ${orderId} cannot be shipped because it is "${status}", not "paid"`);
  }
}
