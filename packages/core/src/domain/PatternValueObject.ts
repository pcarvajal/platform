import { InvalidArgumentError } from "./InvalidArgumentError.js";
import { ValueObject } from "./ValueObject.js";

export abstract class PatternValueObject extends ValueObject<string> {
  constructor(
    value: string,
    private readonly patterns: readonly RegExp[],
    private readonly validValues: readonly string[] = [],
  ) {
    super(value);
    this.checkValueIsValid(value);
  }

  private checkValueIsValid(value: string): void {
    const isExactMatch = this.validValues.includes(value);
    const isPatternMatch = this.patterns.some((pattern) => pattern.test(value));
    if (!isExactMatch && !isPatternMatch) {
      this.throwErrorForInvalidValue(value);
    }
  }

  // Default: raises InvalidArgumentError with the offending value. Override only when a
  // subclass needs a more specific error (e.g. a domain-specific error type).
  protected throwErrorForInvalidValue(value: string): void {
    throw new InvalidArgumentError(`<${this.constructor.name}> does not allow the value <${value}>`);
  }
}
