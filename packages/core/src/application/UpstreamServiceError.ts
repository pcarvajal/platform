import { ApplicationError } from "./ApplicationError.js";

export class UpstreamServiceError extends ApplicationError {
  readonly type = "UpstreamServiceError";
  override readonly origin = "@platform/core";
  constructor(message: string = "Upstream error", details?: unknown, cause?: unknown) {
    super(message, { details, cause });
  }
}
