import type { StandardSchemaV1 } from "@platform/core";
import { validateStandardSchema } from "@platform/core";
import { BadRequestError, UnprocessableEntityError } from "./HttpError.js";
import type { HttpRequest } from "./HttpRequest.js";

// Body schema failures land on `UnprocessableEntityError` (422) with the raw `issues` array as
// `details` (visible in the response body via `HttpError.toResponse()`) — malformed JSON syntax
// is a distinct client mistake, kept on `BadRequestError` (400) instead of folding it into the
// same 422 as a shape mismatch.
export function parseJsonBody<Schema extends StandardSchemaV1>(
  request: HttpRequest,
  schema: Schema,
): StandardSchemaV1.InferOutput<Schema> {
  if (!request.rawBody) {
    throw new BadRequestError("Request body is required");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(request.rawBody);
  } catch (cause) {
    throw new BadRequestError("Request body is not valid JSON", undefined, cause);
  }

  const result = validateStandardSchema(schema, parsed);
  if (!result.success) {
    throw new UnprocessableEntityError("Request body validation failed", result.issues);
  }
  return result.value;
}

// `queryParams`/`pathParams` are already `Record<string, string | undefined>` — the same shape
// `@platform/env`'s `env.object()` schemas validate — so that builder doubles as a query/path
// param schema builder with no extra code, or bring any other Standard Schema-compliant one.
export function parseQueryParams<Schema extends StandardSchemaV1>(
  request: HttpRequest,
  schema: Schema,
): StandardSchemaV1.InferOutput<Schema> {
  const result = validateStandardSchema(schema, request.queryParams);
  if (!result.success) {
    throw new UnprocessableEntityError("Query params validation failed", result.issues);
  }
  return result.value;
}

export function parsePathParams<Schema extends StandardSchemaV1>(
  request: HttpRequest,
  schema: Schema,
): StandardSchemaV1.InferOutput<Schema> {
  const result = validateStandardSchema(schema, request.pathParams);
  if (!result.success) {
    throw new UnprocessableEntityError("Path params validation failed", result.issues);
  }
  return result.value;
}
