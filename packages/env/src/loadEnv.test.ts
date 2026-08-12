import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EnvValidationError } from "./EnvValidationError.js";
import { loadEnv } from "./loadEnv.js";
import { number, string } from "./schema/primitives.js";
import { object } from "./schema/object.js";

describe("loadEnv", () => {
  it("es agnóstico al schema: funciona con un object()/primitivo suelto, no solo con appContext()", () => {
    const schema = object({ NAME: string(), PORT: number() });
    const config = loadEnv(schema, { NAME: "orders-service", PORT: "3000" });
    expect(config).toEqual({ NAME: "orders-service", PORT: 3000 });
  });

  it("usa el source inyectado, no process.env, aunque la misma key exista en el proceso real", () => {
    const original = process.env.PLATFORM_TEST_NAME;
    process.env.PLATFORM_TEST_NAME = "leaked-from-process-env";
    try {
      const schema = object({ PLATFORM_TEST_NAME: string() });
      const config = loadEnv(schema, { PLATFORM_TEST_NAME: "from-injected-source" });
      expect(config).toEqual({ PLATFORM_TEST_NAME: "from-injected-source" });
    } finally {
      if (original === undefined) delete process.env.PLATFORM_TEST_NAME;
      else process.env.PLATFORM_TEST_NAME = original;
    }
  });

  it("schema que falla tira EnvValidationError (no un error genérico)", () => {
    const schema = object({ PORT: number() });
    expect(() => loadEnv(schema, { PORT: "not-a-number" })).toThrow(EnvValidationError);
  });

  describe("source por default", () => {
    const ORIGINAL_ENV = process.env.PLATFORM_TEST_VAR;

    beforeEach(() => {
      process.env.PLATFORM_TEST_VAR = "from-process-env";
    });

    afterEach(() => {
      if (ORIGINAL_ENV === undefined) delete process.env.PLATFORM_TEST_VAR;
      else process.env.PLATFORM_TEST_VAR = ORIGINAL_ENV;
    });

    it("usa process.env cuando source se omite", () => {
      const schema = object({ PLATFORM_TEST_VAR: string() });
      const config = loadEnv(schema);
      expect(config).toEqual({ PLATFORM_TEST_VAR: "from-process-env" });
    });
  });
});
