import { ApplicationError } from "@platform/core";
import { describe, expect, it } from "vitest";
import { EnvValidationError } from "./EnvValidationError.js";

describe("EnvValidationError", () => {
  it("un solo issue con path: mensaje con formato 'path: message'", () => {
    const error = new EnvValidationError([{ path: "PORT", message: "expected a numeric string" }]);
    expect(error.message).toBe("Environment validation failed — PORT: expected a numeric string");
  });

  it("un solo issue sin path: omite el prefijo 'path: '", () => {
    const error = new EnvValidationError([{ message: "Async schemas are not supported" }]);
    expect(error.message).toBe("Environment validation failed — Async schemas are not supported");
  });

  it("múltiples issues se unen con '; ', y .issues conserva cada entrada sin modificar", () => {
    const issues = [
      { path: "PORT", message: "expected a numeric string" },
      { message: "APP_SERVICE_NAME is required" },
      { path: "APP_ENVIRONMENT", message: "expected one of development, staging, production" },
    ];

    const error = new EnvValidationError(issues);

    expect(error.message).toBe(
      "Environment validation failed — PORT: expected a numeric string; " +
        "APP_SERVICE_NAME is required; " +
        "APP_ENVIRONMENT: expected one of development, staging, production",
    );
    expect(error.issues).toEqual(issues);
  });

  it("participa en la jerarquía de errores: instanceof ApplicationError, type/origin fijos", () => {
    const error = new EnvValidationError([{ message: "boom" }]);
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.type).toBe("EnvValidationError");
    expect(error.origin).toBe("@platform/env");
  });
});
