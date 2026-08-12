import { describe, expect, it } from "vitest";
import { IntegrationMismatchError } from "./IntegrationMismatchError.js";
import { UpstreamTimeoutError } from "./UpstreamTimeoutError.js";
import { ValidationError } from "./ValidationError.js";

// Cierra el hueco que deja toScalars.contract.test.ts (NotFoundError/UnexpectedError/
// UpstreamServiceError) — mismo contrato para el resto de los default errors de ApplicationError.
describe("default ApplicationErrors: type/origin/mensaje default", () => {
  const cases: Array<[new (message?: string) => Error, string, string]> = [
    [ValidationError, "ValidationError", "Validation failed"],
    [UpstreamTimeoutError, "UpstreamTimeoutError", "Upstream timeout"],
    [IntegrationMismatchError, "IntegrationMismatchError", "Integration mismatch"],
  ];

  it.each(cases)("%s: mensaje default '%s'", (ErrorClass, type, defaultMessage) => {
    const error = new ErrorClass();
    expect(error.message).toBe(defaultMessage);
    expect((error as unknown as { type: string }).type).toBe(type);
    expect((error as unknown as { origin?: string }).origin).toBe("@platform/core");
  });
});

describe("UpstreamTimeoutError / IntegrationMismatchError: details llega a toScalars().data.details", () => {
  it("UpstreamTimeoutError", () => {
    const scalars = new UpstreamTimeoutError("Upstream timeout", { timeoutMs: 5000 }).toScalars();
    expect(scalars.data.details).toEqual({ timeoutMs: 5000 });
  });

  it("IntegrationMismatchError", () => {
    const scalars = new IntegrationMismatchError("Integration mismatch", {
      expected: "v2",
      received: "v1",
    }).toScalars();
    expect(scalars.data.details).toEqual({ expected: "v2", received: "v1" });
  });
});

describe("ValidationError: no acepta details (solo message/cause)", () => {
  it("toScalars().data no tiene un details con contenido — solo el campo undefined heredado de ApplicationError", () => {
    const scalars = new ValidationError("Validation failed").toScalars();
    expect(scalars.data).toEqual({});
  });
});
