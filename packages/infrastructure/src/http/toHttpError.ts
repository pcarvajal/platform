import {
  IntegrationMismatchError,
  InvalidArgumentError,
  NotFoundError as ApplicationNotFoundError,
  UpstreamServiceError,
  UpstreamTimeoutError,
  ValidationError,
} from "@platform/core";
import {
  BadGatewayError,
  BadRequestError,
  GatewayTimeoutError,
  HttpError,
  InternalServerError,
  NotFoundError,
  UnprocessableEntityError,
} from "./HttpError.js";

/**
 * Translates `core` domain/application errors into their `HttpError` equivalent so that
 * `createHttpDispatcher` returns the right status code even when a use case throws a `core`
 * error instead of an `HttpError` directly. Errors with no known mapping (including
 * `UnexpectedError`) fall back to a generic `InternalServerError` to avoid leaking internals.
 *
 * The original error is always kept as `cause` (never surfaced in the HTTP response body) so
 * that whoever logs the resulting `HttpError` can still see its real origin/type and root cause
 * instead of just the translated HTTP-facing message.
 */
export function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (err instanceof ApplicationNotFoundError)
    return new NotFoundError(err.message, undefined, err);
  if (err instanceof ValidationError)
    return new UnprocessableEntityError(err.message, undefined, err);
  if (err instanceof InvalidArgumentError) return new BadRequestError(err.message, undefined, err);
  if (err instanceof UpstreamTimeoutError)
    return new GatewayTimeoutError(err.message, undefined, err);
  if (err instanceof UpstreamServiceError) return new BadGatewayError(err.message, undefined, err);
  if (err instanceof IntegrationMismatchError)
    return new BadGatewayError(err.message, undefined, err);
  return new InternalServerError("Unexpected server error", undefined, err);
}
