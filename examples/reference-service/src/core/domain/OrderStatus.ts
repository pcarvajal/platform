import { EnumValueObject } from "@platform/core";
import type { OrderStatus } from "./Order.js";

// Set cerrado de estados válidos de una Order — ver references/dominio.md § EnumValueObject. Solo
// se usa en el borde de entrada (validar el filtro `?status=` de apps/listOrdersRoute.ts) para no
// duplicar este set de valores en un schema de zod aparte; el campo interno `Order.status` sigue
// siendo el union plano `OrderStatus`, no esta clase — no hacía falta convertir toda la entidad
// para reutilizar la validación en ese único borde (ver SKILL.md § Cuándo SÍ/NO crear una
// abstracción).
export class OrderStatusVO extends EnumValueObject<OrderStatus> {
  static readonly VALUES: readonly OrderStatus[] = ["created", "paid", "shipped", "cancelled"];

  // El parámetro es `string` (no `OrderStatus`) a propósito: lo que llega de un query param
  // siempre es texto sin validar — el cast interno confía en que `super()` valida en runtime
  // contra `VALUES` y tira InvalidArgumentError si no matchea.
  constructor(value: string) {
    super(value as OrderStatus, OrderStatusVO.VALUES);
  }
}
