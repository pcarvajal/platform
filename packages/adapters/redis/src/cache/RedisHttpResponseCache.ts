import type { Redis } from "ioredis";
import type { Logger } from "@platform/core";
import type { HttpResponse, HttpResponseCache } from "@platform/infrastructure";
import { RedisCache } from "./RedisCache.js";

type SerializedHttpResponse = {
  statusCode: number;
  headers: [string, string][];
  body: string;
};

export type RedisHttpResponseCacheOptions = {
  keyPrefix?: string;
  logger?: Logger;
};

/**
 * Thin HTTP-shaped adapter over `RedisCache`: only handles the `HttpResponse` <->
 * `SerializedHttpResponse` conversion needed to satisfy `HttpResponseCache` from
 * `@platform/infrastructure`. All the Redis mechanics (degrading to a miss on failure, TTLs,
 * key prefixing, logging) live in `RedisCache`.
 */
export class RedisHttpResponseCache implements HttpResponseCache {
  private readonly cache: RedisCache<SerializedHttpResponse>;

  constructor(client: Redis, options: RedisHttpResponseCacheOptions = {}) {
    this.cache = new RedisCache(client, {
      keyPrefix: options.keyPrefix ?? "http-cache:",
      logger: options.logger,
    });
  }

  async get(key: string): Promise<HttpResponse | undefined> {
    const parsed = await this.cache.get(key);
    if (!parsed) return undefined;
    return { statusCode: parsed.statusCode, headers: new Map(parsed.headers), body: parsed.body };
  }

  async set(key: string, response: HttpResponse, ttlSeconds?: number): Promise<void> {
    const serialized: SerializedHttpResponse = {
      statusCode: response.statusCode,
      headers: [...response.headers.entries()],
      body: response.body,
    };
    await this.cache.set(key, serialized, ttlSeconds);
  }
}
