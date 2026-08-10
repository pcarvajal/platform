import { ApplicationError } from "./ApplicationError.js";

export class UnexpectedError extends ApplicationError {
  readonly type = "UnexpectedError";
  override readonly origin = "@platform/core";
  constructor(message: string = "Unexpected error", cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
  }
}
