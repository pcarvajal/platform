import { describe, expect, it } from "vitest";
import { DateValueObject } from "./DateValueObject.js";

class TestDate extends DateValueObject {}

describe("DateValueObject#isBefore / #isAfter", () => {
  it("isBefore es true cuando el value es anterior al del otro", () => {
    const earlier = new TestDate(new Date("2020-01-01"));
    const later = new TestDate(new Date("2020-06-01"));
    expect(earlier.isBefore(later)).toBe(true);
    expect(later.isBefore(earlier)).toBe(false);
  });

  it("isAfter es true cuando el value es posterior al del otro", () => {
    const earlier = new TestDate(new Date("2020-01-01"));
    const later = new TestDate(new Date("2020-06-01"));
    expect(later.isAfter(earlier)).toBe(true);
    expect(earlier.isAfter(later)).toBe(false);
  });

  it("instante igual: ni antes ni después", () => {
    const a = new TestDate(new Date("2020-01-01T00:00:00.000Z"));
    const b = new TestDate(new Date("2020-01-01T00:00:00.000Z"));
    expect(a.isBefore(b)).toBe(false);
    expect(a.isAfter(b)).toBe(false);
  });
});

describe("DateValueObject#isFuture / #isPast", () => {
  it("isFuture es true para una fecha claramente en el futuro", () => {
    expect(new TestDate(new Date("2100-01-01")).isFuture()).toBe(true);
    expect(new TestDate(new Date("2000-01-01")).isFuture()).toBe(false);
  });

  it("isPast es true para una fecha claramente en el pasado", () => {
    expect(new TestDate(new Date("2000-01-01")).isPast()).toBe(true);
    expect(new TestDate(new Date("2100-01-01")).isPast()).toBe(false);
  });
});
