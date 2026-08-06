import { InvalidArgumentError } from "./InvalidArgumentError.js";

type Scalars = string | number | boolean | Date;

export abstract class ValueObject<T extends Scalars> {
  constructor(readonly value: T) {
    this.ensureValueIsDefined(value);
  }

  private ensureValueIsDefined(value: T): void {
    if (value === null || value === undefined) {
      throw new InvalidArgumentError("Value object is not defined");
    }
  }

  equals(other: ValueObject<T>): boolean {
    return other.constructor.name === this.constructor.name && other.value === this.value;
  }

  toString(): string {
    return this.value.toString();
  }
}
