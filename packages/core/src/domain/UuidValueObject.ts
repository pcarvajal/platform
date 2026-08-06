import { randomUUID } from "crypto";
import { InvalidArgumentError } from "./InvalidArgumentError.js";
import { ValueObject } from "./ValueObject.js";

export class Uuid<T extends string = string> extends ValueObject<T> {
  constructor(value: T) {
    super(value);
    this.ensureIsValidUuid(value);
  }

  static random(): Uuid<string> {
    return new Uuid(randomUUID());
  }

  private ensureIsValidUuid(id: string): void {
    const isValid = new RegExp(
      /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
    );

    if (!isValid.test(id)) {
      throw new InvalidArgumentError(`<${this.constructor.name}> does not allow the value <${id}>`);
    }
  }
}
