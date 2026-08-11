import {
  IntegrationMismatchError,
  InvalidArgumentError,
  NotFoundError as CoreNotFoundError,
  UnexpectedError,
  UpstreamServiceError,
  UpstreamTimeoutError,
  ValidationError,
  toApplicationFailure,
  toApplicationSuccess,
} from "@platform/core";
import { describe, expect, it } from "vitest";
import { toHttpResponse } from "./toHttpResponse.js";

// Ancla la tabla type -> status code de toHttpResponse (ver CONTRIBUTING.md § "Qué es breaking en
// la jerarquía de errores") — cambiar a qué HttpError mapea un type existente es breaking de
// comportamiento para cualquier consumidor HTTP, aunque tsc no lo detecte.
describe("toHttpResponse() contract", () => {
  it("éxito: 200 por defecto con { data } como body", () => {
    const response = toHttpResponse(toApplicationSuccess({ id: "order-1" }));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ data: { id: "order-1" } });
  });

  it("éxito: successStatusCode custom", () => {
    const response = toHttpResponse(toApplicationSuccess({ id: "order-1" }), {
      successStatusCode: 201,
    });
    expect(response.statusCode).toBe(201);
  });

  const cases: Array<[error: unknown, expectedStatus: number]> = [
    [new CoreNotFoundError("Order not found"), 404],
    [new ValidationError("Validation failed"), 422],
    [new InvalidArgumentError("bad"), 400],
    [new UpstreamTimeoutError("Upstream timeout"), 504],
    [new UpstreamServiceError("Upstream error"), 502],
    [new IntegrationMismatchError("Integration mismatch"), 502],
    [new UnexpectedError("Unexpected error"), 500],
  ];

  it.each(cases)("%# mapea %s a status %i", (error, expectedStatus) => {
    const response = toHttpResponse(toApplicationFailure(error));
    expect(response.statusCode).toBe(expectedStatus);
  });

  it("un type sin mapeo explícito cae en 500 sin reenviar el mensaje original", () => {
    const response = toHttpResponse(toApplicationFailure(new Error("db connection string leaked")));
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).message).not.toContain("db connection string leaked");
  });
});
