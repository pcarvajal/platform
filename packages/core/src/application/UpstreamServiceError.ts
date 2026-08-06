import { ApplicationError } from "./ApplicationError.js";

export class UpstreamServiceError extends ApplicationError {
  type = "UpstreamServiceError";
  readonly origin = "@platform/core";
  constructor(message: string = "Upstream error", cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
  }
}
