import type { StandardSchemaV1 } from "@platform/core";
import { describe, expect, it } from "vitest";
import { array, number, string } from "./primitives.js";
import { object } from "./object.js";

function validate<T>(
  schema: StandardSchemaV1<unknown, T>,
  value: unknown,
): StandardSchemaV1.Result<T> {
  const result = schema["~standard"].validate(value);
  if (result instanceof Promise) throw new Error("expected a sync validation result");
  return result;
}

describe("object()", () => {
  it("todos los campos válidos produce { value } con la forma correcta", () => {
    const schema = object({ NAME: string(), PORT: number() });
    expect(validate(schema, { NAME: "orders-service", PORT: "3000" })).toEqual({
      value: { NAME: "orders-service", PORT: 3000 },
    });
  });

  it("un campo inválido produce un issue con path [key], sin prefijo (nivel raíz)", () => {
    const schema = object({ NAME: string(), PORT: number() });
    const result = validate(schema, { NAME: "orders-service", PORT: "not-a-number" });
    expect(result.issues).toEqual([
      expect.objectContaining({ path: ["PORT"], message: expect.any(String) }),
    ]);
  });

  it("un campo con path anidado (ej. array()) queda prefijado como [key, ...nestedPath]", () => {
    const schema = object({ ORIGINS: array(number()) });
    const result = validate(schema, { ORIGINS: "1,abc,3" });
    expect(result.issues).toEqual([
      expect.objectContaining({ path: ["ORIGINS", 1], message: expect.any(String) }),
    ]);
  });

  it("input undefined se trata como {} — los campos requeridos fallan normal, sin explotar", () => {
    const schema = object({ NAME: string() });
    const result = validate(schema, undefined);
    expect(result.issues).toEqual([expect.objectContaining({ path: ["NAME"] })]);
  });
});
