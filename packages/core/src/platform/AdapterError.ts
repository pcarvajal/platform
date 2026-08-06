import { PlatformError } from "./PlatformError.js";

export abstract class AdapterError extends PlatformError {
  constructor(
    public readonly origin: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}
