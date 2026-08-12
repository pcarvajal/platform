import { describe, expect, it } from "vitest";
import { PatternValueObject } from "./PatternValueObject.js";

class TestSku extends PatternValueObject {
  constructor(value: string) {
    super(value, [/^SKU-\d+$/], ["LEGACY"]);
  }
}

describe("PatternValueObject", () => {
  it("un valor que matchea el regex es válido", () => {
    const sku = new TestSku("SKU-123");
    expect(sku.value).toBe("SKU-123");
  });

  it("un valor en validValues (match exacto, no por regex) también es válido", () => {
    const sku = new TestSku("LEGACY");
    expect(sku.value).toBe("LEGACY");
  });

  it("un valor que no matchea ningún regex ni validValues tira InvalidArgumentError", () => {
    expect(() => new TestSku("not-a-sku")).toThrow(
      /<TestSku> does not allow the value <not-a-sku>/,
    );
  });
});
