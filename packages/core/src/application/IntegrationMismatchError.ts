import { ApplicationError } from "./ApplicationError.js";

export class IntegrationMismatchError extends ApplicationError {
  type = "IntegrationMismatchError";
  readonly origin = "@platform/core";
  constructor(message: string = "Integration mismatch", cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
  }
}
