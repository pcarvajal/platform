import type { ApplicationResult } from "@platform/core";
import { ok } from "../ports/ApiResponse.js";
import {
  BadGatewayError,
  BadRequestError,
  GatewayTimeoutError,
  HttpError,
  InternalServerError,
  NotFoundError,
  UnprocessableEntityError,
} from "./HttpError.js";
import type { HttpResponse } from "./HttpResponse.js";

const JSON_HEADERS = new Map([["Content-Type", "application/json"]]);

// Mismo mapeo que `toHttpError`, pero indexado por el `type` (string) que ya trae
// ApplicationResult en vez de `instanceof` — el Result serializa el error a datos planos, no
// conserva la instancia original.
const HTTP_ERROR_BY_APPLICATION_ERROR_TYPE: Record<
  string,
  new (message?: string, details?: unknown) => HttpError
> = {
  NotFoundError: NotFoundError,
  ValidationError: UnprocessableEntityError,
  InvalidArgumentError: BadRequestError,
  UpstreamTimeoutError: GatewayTimeoutError,
  UpstreamServiceError: BadGatewayError,
  IntegrationMismatchError: BadGatewayError,
};

// Cualquier `type` fuera de la tabla (incluido "UnexpectedError") cae en 500 sin reenviar el
// mensaje original, igual que el fallback de `toHttpError`.
export function toHttpResponse<T>(
  result: ApplicationResult<T>,
  options?: { successStatusCode?: number },
): HttpResponse {
  if (result.ok) {
    return {
      statusCode: options?.successStatusCode ?? 200,
      headers: JSON_HEADERS,
      body: JSON.stringify(ok(result.data)),
    };
  }

  const HttpErrorClass = HTTP_ERROR_BY_APPLICATION_ERROR_TYPE[result.error.type];
  const httpError = HttpErrorClass
    ? new HttpErrorClass(result.error.message, result.error.data)
    : new InternalServerError("Unexpected server error");

  const { statusCode, body } = httpError.toResponse();
  return { statusCode, headers: JSON_HEADERS, body };
}
