import type { Redis } from "ioredis";
import type { Logger } from "@platform/core";
import type { HttpResponse, HttpResponseCache } from "@platform/infrastructure";

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
 * A Redis-backed HttpResponseCache is a performance optimization, not a source of truth: a Redis
 * outage or a corrupted entry degrades to a cache miss (logged via `logger`, if provided) instead
 * of failing the request that's actually asking for data.
 */
export class RedisHttpResponseCache implements HttpResponseCache {
  private readonly keyPrefix: string;
  private readonly logger?: Logger;

  constructor(
    private readonly client: Redis,
    options: RedisHttpResponseCacheOptions = {},
  ) {
    this.keyPrefix = options.keyPrefix ?? "http-cache:";
    this.logger = options.logger;
  }

  async get(key: string): Promise<HttpResponse | undefined> {
    let raw: string | null;
    try {
      raw = await this.client.get(this.prefixed(key));
    } catch (err) {
      this.logger?.warn("RedisHttpResponseCache.get failed, treating as cache miss", { key, err });
      return undefined;
    }
    if (raw === null) return undefined;

    try {
      const parsed = JSON.parse(raw) as SerializedHttpResponse;
      return { statusCode: parsed.statusCode, headers: new Map(parsed.headers), body: parsed.body };
    } catch (err) {
      this.logger?.warn(
        "RedisHttpResponseCache.get found a malformed entry, treating as cache miss",
        {
          key,
          err,
        },
      );
      return undefined;
    }
  }

  async set(key: string, response: HttpResponse, ttlSeconds?: number): Promise<void> {
    const serialized: SerializedHttpResponse = {
      statusCode: response.statusCode,
      headers: [...response.headers.entries()],
      body: response.body,
    };

    try {
      if (ttlSeconds) {
        await this.client.set(this.prefixed(key), JSON.stringify(serialized), "EX", ttlSeconds);
      } else {
        await this.client.set(this.prefixed(key), JSON.stringify(serialized));
      }
    } catch (err) {
      this.logger?.warn("RedisHttpResponseCache.set failed, response was not cached", { key, err });
    }
  }

  private prefixed(key: string): string {
    return `${this.keyPrefix}${key}`;
  }
}
