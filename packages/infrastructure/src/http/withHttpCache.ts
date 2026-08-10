import type { HttpRequest } from "./HttpRequest.js";
import type { HttpResponse } from "./HttpResponse.js";
import type { HttpResponseCache } from "./HttpResponseCache.js";

export type HttpCacheKeyBuilder = (request: HttpRequest) => string;

export type WithHttpCacheOptions = {
  ttlSeconds?: number;
  keyBuilder?: HttpCacheKeyBuilder;
};

const defaultKeyBuilder: HttpCacheKeyBuilder = (request) => {
  const query = Object.entries(request.queryParams)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return query ? `${request.method} ${request.path}?${query}` : `${request.method} ${request.path}`;
};

/**
 * Wraps a single route's handle with a read-through cache: a hit short-circuits the handler, a
 * miss calls it and stores the 2xx response before returning it. Only caches GET requests by
 * default (only method safe to cache without a key builder that accounts for the body) — pass a
 * `keyBuilder` that folds in the body if you need to cache other methods.
 */
export function withHttpCache(
  handle: (request: HttpRequest) => Promise<HttpResponse>,
  cache: HttpResponseCache,
  options: WithHttpCacheOptions = {},
): (request: HttpRequest) => Promise<HttpResponse> {
  const keyBuilder = options.keyBuilder ?? defaultKeyBuilder;

  return async (request) => {
    if (!options.keyBuilder && request.method !== "GET") {
      return handle(request);
    }

    const key = keyBuilder(request);
    const cached = await cache.get(key);
    if (cached) return cached;

    const response = await handle(request);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      await cache.set(key, response, options.ttlSeconds);
    }
    return response;
  };
}
