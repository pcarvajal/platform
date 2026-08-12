import { describe, expect, it } from "vitest";
import { EnumValueObject } from "./EnumValueObject.js";

type Status = "open" | "closed";

class TestStatus extends EnumValueObject<Status> {
  constructor(value: Status) {
    super(value, ["open", "closed"]);
  }
}

describe("EnumValueObject", () => {
  it("un valor válido construye sin tirar, .value accesible", () => {
    const status = new TestStatus("open");
    expect(status.value).toBe("open");
  });

  it("un valor inválido tira InvalidArgumentError nombrando el constructor y el valor ofensivo", () => {
    expect(() => new TestStatus("archived" as Status)).toThrow(
      /<TestStatus> does not allow the value <archived>/,
    );
  });
});
