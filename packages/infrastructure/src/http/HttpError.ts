import { ExtensibleError } from "@platform/core";

export abstract class HttpError extends ExtensibleError {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
    cause?: unknown,
  ) {
    super(message, cause !== undefined ? { cause } : undefined);
  }

  toResponse() {
    return {
      statusCode: this.statusCode,
      body: JSON.stringify({
        error: this.type,
        message: this.message,
        ...(this.details !== undefined && { details: this.details }),
      }),
    };
  }
}

export class BadRequestError extends HttpError {
  type = "BadRequestError";
  readonly origin = "@platform/infrastructure";
  constructor(message = "Bad request", details?: unknown, cause?: unknown) {
    super(400, message, details, cause);
  }
}

export class UnauthorizedError extends HttpError {
  type = "UnauthorizedError";
  readonly origin = "@platform/infrastructure";
  constructor(message = "Unauthorized", details?: unknown, cause?: unknown) {
    super(401, message, details, cause);
  }
}

export class ForbiddenError extends HttpError {
  type = "ForbiddenError";
  readonly origin = "@platform/infrastructure";
  constructor(message = "Forbidden", details?: unknown, cause?: unknown) {
    super(403, message, details, cause);
  }
}

// Same name as `core`'s application-layer `NotFoundError` — that one has no status code and
// is translated into this one (404) by `toHttpError`. Import alias if both are needed together.
export class NotFoundError extends HttpError {
  type = "NotFoundError";
  readonly origin = "@platform/infrastructure";
  constructor(message = "Not found", details?: unknown, cause?: unknown) {
    super(404, message, details, cause);
  }
}

export class TimeoutError extends HttpError {
  type = "TimeoutError";
  readonly origin = "@platform/infrastructure";
  constructor(message = "Timeout", details?: unknown, cause?: unknown) {
    super(408, message, details, cause);
  }
}

export class ConflictError extends HttpError {
  type = "ConflictError";
  readonly origin = "@platform/infrastructure";
  constructor(message = "Conflict", details?: unknown, cause?: unknown) {
    super(409, message, details, cause);
  }
}

export class UnprocessableEntityError extends HttpError {
  type = "UnprocessableEntityError";
  readonly origin = "@platform/infrastructure";
  constructor(message = "Unprocessable entity", details?: unknown, cause?: unknown) {
    super(422, message, details, cause);
  }
}

export class InternalServerError extends HttpError {
  type = "InternalServerError";
  readonly origin = "@platform/infrastructure";
  constructor(message = "Internal server error", details?: unknown, cause?: unknown) {
    super(500, message, details, cause);
  }
}

export class BadGatewayError extends HttpError {
  type = "BadGatewayError";
  readonly origin = "@platform/infrastructure";
  constructor(message = "Bad gateway", details?: unknown, cause?: unknown) {
    super(502, message, details, cause);
  }
}

export class ServiceUnavailableError extends HttpError {
  type = "ServiceUnavailableError";
  readonly origin = "@platform/infrastructure";
  constructor(message = "Service unavailable", details?: unknown, cause?: unknown) {
    super(503, message, details, cause);
  }
}

export class GatewayTimeoutError extends HttpError {
  type = "GatewayTimeoutError";
  readonly origin = "@platform/infrastructure";
  constructor(message = "Gateway timeout", details?: unknown, cause?: unknown) {
    super(504, message, details, cause);
  }
}
