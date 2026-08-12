import { describe, expect, it } from "vitest";
import { DomainEvent } from "./DomainEvent.js";

class TestEvent extends DomainEvent {
  constructor(aggregateId: string, eventId?: string, occurredOn?: Date) {
    super("TestEvent", aggregateId, eventId, occurredOn);
  }

  toScalars() {
    return { aggregateId: this.aggregateId };
  }
}

describe("DomainEvent", () => {
  it("eventId/occurredOn explícitos se usan tal cual, sin pisarlos", () => {
    const occurredOn = new Date("2020-01-01T00:00:00.000Z");
    const event = new TestEvent("order-1", "11111111-1111-4111-8111-111111111111", occurredOn);

    expect(event.eventId).toBe("11111111-1111-4111-8111-111111111111");
    expect(event.occurredOn).toBe(occurredOn);
  });

  it("eventId omitido cae al fallback Uuid.random().value (formato UUID válido)", () => {
    const event = new TestEvent("order-1");
    expect(event.eventId).toMatch(
      /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
    );
  });

  it("occurredOn omitido cae al fallback new Date()", () => {
    const before = Date.now();
    const event = new TestEvent("order-1");
    const after = Date.now();

    expect(event.occurredOn).toBeInstanceOf(Date);
    expect(event.occurredOn!.getTime()).toBeGreaterThanOrEqual(before);
    expect(event.occurredOn!.getTime()).toBeLessThanOrEqual(after);
  });
});
