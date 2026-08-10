import { ApplicationError } from "./ApplicationError.js";

export class IntegrationMismatchError extends ApplicationError {
  readonly type = "IntegrationMismatchError";
  override readonly origin = "@platform/core";
  constructor(message: string = "Integration mismatch", details?: unknown, cause?: unknown) {
    super(message, { details, cause });
  }
}
