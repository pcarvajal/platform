import type { HttpRequest } from "@platform/infrastructure";

const DEFAULTS: HttpRequest = {
  method: "GET",
  path: "/",
  pathParams: {},
  queryParams: {},
  headers: {},
  rawBody: null,
};

/**
 * Builds a valid `HttpRequest` with sane defaults so a controller test only has to specify the
 * fields it actually cares about, instead of the full shape every time.
 */
export function buildHttpRequest(overrides: Partial<HttpRequest> = {}): HttpRequest {
  return { ...DEFAULTS, ...overrides };
}
