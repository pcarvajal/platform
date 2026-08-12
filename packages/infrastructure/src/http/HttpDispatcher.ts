import { randomUUID } from "node:crypto";
import type { HttpRequest } from "./HttpRequest.js";
import type { HttpResponse } from "./HttpResponse.js";
import { toHttpError } from "./toHttpError.js";

const JSON_HEADERS = new Map([["Content-Type", "application/json"]]);

export function createHttpDispatcher<TRawEvent>(
  mapRequest: (rawEvent: TRawEvent) => Promise<HttpRequest>,
  handle: (request: HttpRequest) => Promise<HttpResponse>,
): (rawEvent: TRawEvent) => Promise<HttpResponse> {
  return async (rawEvent) => {
    try {
      const httpRequest = await mapRequest(rawEvent);
      return await handle(withRequestId(httpRequest));
    } catch (err) {
      const { statusCode, body } = toHttpError(err).toResponse();
      return { statusCode, headers: JSON_HEADERS, body };
    }
  };
}

// Único punto que genera/propaga el id de correlación (ver @platform/core RequestContext) —
// evita duplicar "leer x-request-id o generar uno" en cada HttpRequestMapper de cada proveedor.
function withRequestId(request: HttpRequest): HttpRequest {
  if (request.requestId) return request;
  return { ...request, requestId: findHeader(request.headers, "x-request-id") ?? randomUUID() };
}

function findHeader(headers: HttpRequest["headers"], name: string): string | undefined {
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
  return key ? headers[key] : undefined;
}
