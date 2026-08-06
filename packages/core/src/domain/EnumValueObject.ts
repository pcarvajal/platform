import { InvalidArgumentError } from "./InvalidArgumentError.js";
import { ValueObject } from "./ValueObject.js";

export abstract class EnumValueObject<T extends string> extends ValueObject<T> {
  constructor(
    value: T,
    private readonly validValues: readonly T[],
  ) {
    super(value);
    this.checkValueIsValid(value);
  }

  private checkValueIsValid(value: T): void {
    if (!this.validValues.includes(value)) {
      this.throwErrorForInvalidValue(value);
    }
  }

  // Default: raises InvalidArgumentError with the offending value. Override only when a
  // subclass needs a more specific error (e.g. a domain-specific error type).
  protected throwErrorForInvalidValue(value: T): void {
    throw new InvalidArgumentError(`<${this.constructor.name}> does not allow the value <${value}>`);
  }
}
