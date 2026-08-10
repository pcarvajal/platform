import { DomainError } from "./DomainError.js";

export class InvalidArgumentError extends DomainError {
  readonly type = "InvalidArgumentError";
  override readonly origin = "@platform/core";

  constructor(message?: string, cause?: unknown) {
    super(message ?? "Invalid argument provided", cause !== undefined ? { cause } : undefined);
  }
}
