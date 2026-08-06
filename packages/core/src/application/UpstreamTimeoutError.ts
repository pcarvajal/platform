import { ApplicationError } from "./ApplicationError.js";

export class UpstreamTimeoutError extends ApplicationError {
  type = "UpstreamTimeoutError";
  readonly origin = "@platform/core";
  constructor(message: string = "Upstream timeout", cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
  }
}
