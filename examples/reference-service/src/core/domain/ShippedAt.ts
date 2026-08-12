import { DateValueObject, InvalidArgumentError } from "@platform/core";

// No se puede marcar una orden como enviada con una fecha futura — reutiliza `isFuture()` de
// DateValueObject (ver references/dominio.md) en vez de comparar Dates a mano en Order.ship().
export class ShippedAt extends DateValueObject {
  constructor(value: Date) {
    super(value);
    if (this.isFuture()) {
      throw new InvalidArgumentError(`shippedAt cannot be in the future: ${value.toISOString()}`);
    }
  }
}
