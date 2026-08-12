import type { StandardSchemaV1 } from "@platform/core";
import { describe, expect, it } from "vitest";
import { number, string } from "./primitives.js";

function validate<T>(
  schema: StandardSchemaV1<unknown, T>,
  value: unknown,
): StandardSchemaV1.Result<T> {
  const result = schema["~standard"].validate(value);
  if (result instanceof Promise) throw new Error("expected a sync validation result");
  return result;
}

describe("EnvValueSchema#optional", () => {
  it("undefined y string vacío pasan como undefined sin correr el validador envuelto", () => {
    expect(validate(number().optional(), undefined)).toEqual({ value: undefined });
    expect(validate(number().optional(), "")).toEqual({ value: undefined });
  });

  it("un valor presente y válido se valida normalmente", () => {
    expect(validate(number().optional(), "42")).toEqual({ value: 42 });
  });

  it("un valor presente pero inválido sigue fallando — optional no tapa valores inválidos", () => {
    expect(validate(number().optional(), "not-a-number").issues).toBeDefined();
  });
});

describe("EnvValueSchema#default", () => {
  it("undefined y string vacío usan el fallback", () => {
    expect(validate(number().default(3000), undefined)).toEqual({ value: 3000 });
    expect(validate(number().default(3000), "")).toEqual({ value: 3000 });
  });

  it("un valor presente y válido usa el resultado del validador envuelto, no el fallback", () => {
    expect(validate(number().default(3000), "8080")).toEqual({ value: 8080 });
  });

  it("un valor presente pero inválido sigue emitiendo el issue del validador envuelto", () => {
    expect(validate(number().default(3000), "abc").issues).toBeDefined();
  });

  it("encadenado end-to-end, como PORT: env.port().default(3000) en SKILL.md", () => {
    const schema = number().default(3000);
    expect(validate(schema, undefined)).toEqual({ value: 3000 });
    expect(validate(schema, "5000")).toEqual({ value: 5000 });
  });

  it("funciona igual sobre string()", () => {
    expect(validate(string().default("dev"), undefined)).toEqual({ value: "dev" });
    expect(validate(string().default("dev"), "prod")).toEqual({ value: "prod" });
  });
});
