import { ExtensibleError } from "../platform/index.js";

// Extend this for your own application error taxonomy. Deliberately not a `PlatformError` — see
// `ExtensibleError` for why.
//
// `details` is `public readonly` (same shape as `infrastructure`'s `HttpError`) so it's picked up
// automatically by `StructuredError.toScalars()` — pass whatever structured context explains the
// failure (e.g. an upstream response body) instead of interpolating it into `message`.
export abstract class ApplicationError extends ExtensibleError {
  readonly details?: unknown;

  constructor(message: string, options?: { details?: unknown; cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.details = options?.details;
  }
}
