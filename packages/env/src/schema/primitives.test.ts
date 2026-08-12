import type { StandardSchemaV1 } from "@platform/core";
import { describe, expect, it } from "vitest";
import { array, boolean, json, number, port, string, url } from "./primitives.js";

function validate<T>(
  schema: StandardSchemaV1<unknown, T>,
  value: unknown,
): StandardSchemaV1.Result<T> {
  const result = schema["~standard"].validate(value);
  if (result instanceof Promise) throw new Error("expected a sync validation result");
  return result;
}

describe("env.number()", () => {
  it("string numérico válido se parsea a número", () => {
    expect(validate(number(), "42")).toEqual({ value: 42 });
  });

  it("string vacío o no numérico produce un issue", () => {
    expect(validate(number(), "").issues).toBeDefined();
    expect(validate(number(), "abc").issues).toBeDefined();
  });
});

describe("env.boolean()", () => {
  it('"true"/"false" se parsean a boolean', () => {
    expect(validate(boolean(), "true")).toEqual({ value: true });
    expect(validate(boolean(), "false")).toEqual({ value: false });
  });

  it("cualquier otro valor produce un issue", () => {
    expect(validate(boolean(), "1").issues).toBeDefined();
    expect(validate(boolean(), "TRUE").issues).toBeDefined();
    expect(validate(boolean(), "").issues).toBeDefined();
  });
});

describe("env.url()", () => {
  it("URL absoluta válida pasa tal cual", () => {
    expect(validate(url(), "https://example.com/path")).toEqual({
      value: "https://example.com/path",
    });
  });

  it("string vacío o malformado produce un issue", () => {
    expect(validate(url(), "").issues).toBeDefined();
    expect(validate(url(), "not-a-url").issues).toBeDefined();
  });
});

describe("env.port()", () => {
  it("rango válido 1-65535, incluidos los bordes", () => {
    expect(validate(port(), "1")).toEqual({ value: 1 });
    expect(validate(port(), "65535")).toEqual({ value: 65535 });
    expect(validate(port(), "3000")).toEqual({ value: 3000 });
  });

  it("fuera de rango, no entero, o no numérico produce un issue", () => {
    expect(validate(port(), "0").issues).toBeDefined();
    expect(validate(port(), "65536").issues).toBeDefined();
    expect(validate(port(), "3000.5").issues).toBeDefined();
    expect(validate(port(), "abc").issues).toBeDefined();
  });
});

describe("env.array()", () => {
  it("split por coma + trim, happy path", () => {
    expect(validate(array(string()), "a, b ,c")).toEqual({ value: ["a", "b", "c"] });
  });

  it("separator custom", () => {
    expect(validate(array(string(), { separator: "|" }), "a|b|c")).toEqual({
      value: ["a", "b", "c"],
    });
  });

  it("un item inválido produce un issue con path [index, ...]", () => {
    const result = validate(array(number()), "1,abc,3");
    expect(result.issues).toBeDefined();
    expect(result.issues?.[0]?.path).toEqual([1]);
  });

  it("string vacío produce un issue, no un array vacío", () => {
    expect(validate(array(string()), "").issues).toBeDefined();
  });
});

describe("env.json()", () => {
  it("sin schema: JSON válido se parsea (objeto, array, primitivo)", () => {
    expect(validate(json(), '{"a":1}')).toEqual({ value: { a: 1 } });
    expect(validate(json(), "[1,2,3]")).toEqual({ value: [1, 2, 3] });
    expect(validate(json(), "42")).toEqual({ value: 42 });
  });

  it("sin schema: JSON malformado produce un issue", () => {
    expect(validate(json(), "{not json").issues).toBeDefined();
  });

  // json(schema) valida el valor ya parseado (no un string crudo de env) — por eso el schema
  // interno acá es un StandardSchemaV1 mínimo hecho a mano (el mismo tipo de schema de terceros,
  // ej. zod, que documenta SKILL.md: `env.json(z.object({...}))`), no uno de los builders
  // string-oriented de este mismo archivo (number()/boolean()/etc. esperan un string crudo).
  const parsedNumberSchema: StandardSchemaV1<unknown, number> = {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value: unknown) =>
        typeof value === "number" ? { value } : { issues: [{ message: "expected a number" }] },
    },
  };

  it("con schema: JSON válido que matchea el schema devuelve el valor validado", () => {
    const schema = json(parsedNumberSchema);
    expect(validate(schema, "42")).toEqual({ value: 42 });
  });

  it("con schema: JSON válido que NO matchea surge el issue del schema interno, no se traga", () => {
    const schema = json(parsedNumberSchema);
    const result = validate(schema, '"not a number"');
    expect(result.issues).toBeDefined();
  });
});
