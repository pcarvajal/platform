import {
  IntegrationMismatchError,
  InvalidArgumentError,
  NotFoundError as ApplicationNotFoundError,
  UnexpectedError,
  UpstreamServiceError,
  UpstreamTimeoutError,
  ValidationError,
} from "@platform/core";
import { describe, expect, it } from "vitest";
import {
  BadGatewayError,
  BadRequestError,
  GatewayTimeoutError,
  InternalServerError,
  NotFoundError,
  UnprocessableEntityError,
} from "./HttpError.js";
import { toHttpError } from "./toHttpError.js";

// Ancla la mitad simétrica de toHttpResponse.contract.test.ts: el mapeo error-de-`core` ->
// HttpError (ver CONTRIBUTING.md § "Qué es breaking en la jerarquía de errores") — es un contrato
// de datos entre servicios, no solo de tipos.
describe("toHttpError() contract", () => {
  const cases: Array<
    [error: unknown, expectedClass: new (...args: never[]) => Error, status: number]
  > = [
    [new ApplicationNotFoundError("Order not found"), NotFoundError, 404],
    [new ValidationError("Validation failed"), UnprocessableEntityError, 422],
    [new InvalidArgumentError("bad"), BadRequestError, 400],
    [new UpstreamTimeoutError("Upstream timeout"), GatewayTimeoutError, 504],
    [new UpstreamServiceError("Upstream error"), BadGatewayError, 502],
    [new IntegrationMismatchError("Integration mismatch"), BadGatewayError, 502],
  ];

  it.each(cases)("%# mapea %s a %s (%i)", (error, expectedClass, status) => {
    const httpError = toHttpError(error);
    expect(httpError).toBeInstanceOf(expectedClass);
    expect(httpError.statusCode).toBe(status);
    expect(httpError.message).toBe((error as Error).message);
    expect(httpError.cause).toBe(error);
  });

  it("una instancia que ya es HttpError pasa sin cambios (no se re-envuelve)", () => {
    const original = new BadRequestError("already an HttpError");
    expect(toHttpError(original)).toBe(original);
  });

  it("un error de core sin mapeo (ej. UnexpectedError) cae a InternalServerError genérico, preservando el original como cause", () => {
    const original = new UnexpectedError("internal detail that shouldn't leak");
    const httpError = toHttpError(original);
    expect(httpError).toBeInstanceOf(InternalServerError);
    expect(httpError.statusCode).toBe(500);
    expect(httpError.message).toBe("Unexpected server error");
    expect(httpError.message).not.toContain("internal detail");
    expect(httpError.cause).toBe(original);
  });

  it("un Error plano (no de core) también cae a InternalServerError, conservando el original como cause", () => {
    const original = new Error("db connection string leaked");
    const httpError = toHttpError(original);
    expect(httpError).toBeInstanceOf(InternalServerError);
    expect(httpError.message).not.toContain("db connection string leaked");
    expect(httpError.cause).toBe(original);
  });
});
