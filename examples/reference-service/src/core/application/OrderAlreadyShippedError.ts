import { ApplicationError } from "@platform/core";

// Ejemplo literal de references/errores.md § "ExtensibleError es el punto de extensión público" —
// vive en application (no en domain) porque quien decide "esto ya se envió, no lo reintentes" es
// ShipOrder orquestando (chequea `order.isShipped()` antes de llamar a `order.ship()`), no una
// regla que la propia entidad deba conocer. Sin mapeo HTTP propio (ver toHttpResponse.ts) —
// apps/shipOrderRoute.ts la traduce a ConflictError (409) a mano.
export class OrderAlreadyShippedError extends ApplicationError {
  readonly type = "OrderAlreadyShippedError";

  constructor(readonly orderId: string) {
    super(`Order ${orderId} was already shipped`);
  }
}
