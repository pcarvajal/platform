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
      return await handle(httpRequest);
    } catch (err) {
      const { statusCode, body } = toHttpError(err).toResponse();
      return { statusCode, headers: JSON_HEADERS, body };
    }
  };
}
