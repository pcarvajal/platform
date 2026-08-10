import { ApplicationError } from "./ApplicationError.js";

export class ValidationError extends ApplicationError {
  readonly type = "ValidationError";
  override readonly origin = "@platform/core";
  constructor(message: string = "Validation failed", cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
  }
}
