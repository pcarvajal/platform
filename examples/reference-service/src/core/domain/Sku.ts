import { PatternValueObject } from "@platform/core";

const SKU_PATTERN = /^[A-Z0-9]{2,10}(-[A-Z0-9]{1,10})*$/;

// Value object de línea de pedido — reemplaza el `string` suelto que tenía Order.items: un SKU con
// formato inválido se rechaza en Order.create()/fromScalars() vía InvalidArgumentError (400
// automático, ver references/errores.md), sin que CreateOrder tenga que validarlo a mano.
export class Sku extends PatternValueObject {
  constructor(value: string) {
    super(value, [SKU_PATTERN]);
  }
}
