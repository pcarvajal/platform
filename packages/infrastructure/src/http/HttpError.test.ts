import { describe, expect, it } from "vitest";
import {
  BadGatewayError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  GatewayTimeoutError,
  HttpError,
  InternalServerError,
  NotFoundError,
  ServiceUnavailableError,
  TimeoutError,
  UnauthorizedError,
  UnprocessableEntityError,
} from "./HttpError.js";

type HttpErrorClass = new (message?: string, details?: unknown, cause?: unknown) => HttpError;

const cases: Array<[HttpErrorClass, string, string, number]> = [
  [BadRequestError, "BadRequestError", "Bad request", 400],
  [UnauthorizedError, "UnauthorizedError", "Unauthorized", 401],
  [ForbiddenError, "ForbiddenError", "Forbidden", 403],
  [NotFoundError, "NotFoundError", "Not found", 404],
  [TimeoutError, "TimeoutError", "Timeout", 408],
  [ConflictError, "ConflictError", "Conflict", 409],
  [UnprocessableEntityError, "UnprocessableEntityError", "Unprocessable entity", 422],
  [InternalServerError, "InternalServerError", "Internal server error", 500],
  [BadGatewayError, "BadGatewayError", "Bad gateway", 502],
  [ServiceUnavailableError, "ServiceUnavailableError", "Service unavailable", 503],
  [GatewayTimeoutError, "GatewayTimeoutError", "Gateway timeout", 504],
];

describe("HttpError subclasses", () => {
  it.each(cases)(
    "%s: mensaje default '%s', status %i",
    (ErrorClass, type, defaultMessage, status) => {
      const error = new ErrorClass();
      expect(error.message).toBe(defaultMessage);
      expect(error.statusCode).toBe(status);
      expect(error.type).toBe(type);
      expect(error.origin).toBe("@platform/infrastructure");
    },
  );

  it.each(cases)("%s: acepta un mensaje custom", (ErrorClass, _type, _defaultMessage, status) => {
    const error = new ErrorClass("custom message");
    expect(error.message).toBe("custom message");
    expect(error.statusCode).toBe(status);
  });

  describe("toResponse()", () => {
    it("body es JSON { error: type, message }, sin key details cuando no se pasa", () => {
      const response = new NotFoundError("Order not found").toResponse();
      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        error: "NotFoundError",
        message: "Order not found",
      });
    });

    it("details se incluye en el body cuando se pasa", () => {
      const response = new UnprocessableEntityError("Validation failed", {
        issues: [{ message: "required" }],
      }).toResponse();
      expect(JSON.parse(response.body)).toEqual({
        error: "UnprocessableEntityError",
        message: "Validation failed",
        details: { issues: [{ message: "required" }] },
      });
    });
  });

  it("cause se propaga al mecanismo de cause de ExtensibleError/StructuredError", () => {
    const cause = new Error("upstream failure");
    const error = new BadGatewayError("Bad gateway", undefined, cause);
    expect(error.cause).toBe(cause);
  });
});
