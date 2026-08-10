import { ApplicationError } from "./ApplicationError.js";

export class UpstreamTimeoutError extends ApplicationError {
  readonly type = "UpstreamTimeoutError";
  override readonly origin = "@platform/core";
  constructor(message: string = "Upstream timeout", details?: unknown, cause?: unknown) {
    super(message, { details, cause });
  }
}
