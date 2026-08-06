import { ValueObject } from "./ValueObject.js";

export abstract class DateValueObject extends ValueObject<Date> {
  isBefore(other: DateValueObject): boolean {
    return this.value < other.value;
  }
  isAfter(other: DateValueObject): boolean {
    return this.value > other.value;
  }
  isFuture(): boolean {
    return this.value > new Date();
  }
  isPast(): boolean {
    return this.value < new Date();
  }
}
