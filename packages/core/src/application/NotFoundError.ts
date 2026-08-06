import { ApplicationError } from "./ApplicationError.js";

// Layer-agnostic "not found" (no HTTP status code) — for use in domain/application code.
// `infrastructure`'s `HttpError.NotFoundError` is a different class with the same name;
// `toHttpError` (infrastructure) maps this one to it (404) at the HTTP boundary, so alias
// on import if both are needed in the same file: `NotFoundError as CoreNotFoundError`.
export class NotFoundError extends ApplicationError {
  type = "NotFoundError";
  readonly origin = "@platform/core";
  constructor(message: string = "Not found", cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
  }
}
