import { describe, expect, it } from "vitest";
import type { StandardSchemaV1 } from "./StandardSchema.js";
import { validateStandardSchema } from "./validateStandardSchema.js";

function schemaOf<Output>(
  validate: (
    value: unknown,
  ) => StandardSchemaV1.Result<Output> | Promise<StandardSchemaV1.Result<Output>>,
): StandardSchemaV1<unknown, Output> {
  return { "~standard": { version: 1, vendor: "test", validate } };
}

describe("validateStandardSchema", () => {
  it("éxito síncrono devuelve { success: true, value }", () => {
    const schema = schemaOf<number>(() => ({ value: 42 }));
    expect(validateStandardSchema(schema, "42")).toEqual({ success: true, value: 42 });
  });

  it("fallo síncrono devuelve { success: false, issues } con path aplanado (segmentos plain)", () => {
    const schema = schemaOf(() => ({
      issues: [{ message: "required", path: ["user", "name"] }],
    }));
    expect(validateStandardSchema(schema, {})).toEqual({
      success: false,
      issues: [{ path: "user.name", message: "required" }],
    });
  });

  it("path aplanado también soporta segmentos { key } (forma alternativa del spec)", () => {
    const schema = schemaOf(() => ({
      issues: [{ message: "required", path: [{ key: "user" }, { key: "name" }] }],
    }));
    expect(validateStandardSchema(schema, {})).toEqual({
      success: false,
      issues: [{ path: "user.name", message: "required" }],
    });
  });

  it("un issue sin path deja path undefined (no un string vacío)", () => {
    const schema = schemaOf(() => ({ issues: [{ message: "top-level failure" }] }));
    expect(validateStandardSchema(schema, {})).toEqual({
      success: false,
      issues: [{ path: undefined, message: "top-level failure" }],
    });
  });

  it("un schema cuyo validate() devuelve una Promise se rechaza como 'no soportado', sin colgarse", () => {
    const schema = schemaOf<number>(async () => ({ value: 42 }));
    expect(validateStandardSchema(schema, "42")).toEqual({
      success: false,
      issues: [{ message: "Async schemas are not supported — validation must be synchronous" }],
    });
  });
});
