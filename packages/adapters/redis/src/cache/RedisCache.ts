import type { Redis } from "ioredis";
import type { Logger } from "@platform/core";
import type { Cache } from "@platform/infrastructure";

export type RedisCacheOptions<T> = {
  keyPrefix?: string;
  logger?: Logger;
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T;
};

/**
 * A Redis-backed Cache is a performance optimization, not a source of truth: a Redis outage or a
 * corrupted entry degrades to a cache miss (logged via `logger`, if provided) instead of failing
 * whatever is actually asking for the value.
 */
export class RedisCache<T> implements Cache<T> {
  private readonly keyPrefix: string;
  private readonly logger?: Logger;
  private readonly serialize: (value: T) => string;
  private readonly deserialize: (raw: string) => T;

  constructor(
    private readonly client: Redis,
    options: RedisCacheOptions<T> = {},
  ) {
    this.keyPrefix = options.keyPrefix ?? "cache:";
    this.logger = options.logger;
    this.serialize = options.serialize ?? ((value) => JSON.stringify(value));
    this.deserialize = options.deserialize ?? ((raw) => JSON.parse(raw) as T);
  }

  async get(key: string): Promise<T | undefined> {
    let raw: string | null;
    try {
      raw = await this.client.get(this.prefixed(key));
    } catch (err) {
      this.logger?.warn("RedisCache.get failed, treating as cache miss", { key, err });
      return undefined;
    }
    if (raw === null) return undefined;

    try {
      return this.deserialize(raw);
    } catch (err) {
      this.logger?.warn("RedisCache.get found a malformed entry, treating as cache miss", {
        key,
        err,
      });
      return undefined;
    }
  }

  async set(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = this.serialize(value);

    try {
      if (ttlSeconds) {
        await this.client.set(this.prefixed(key), serialized, "EX", ttlSeconds);
      } else {
        await this.client.set(this.prefixed(key), serialized);
      }
    } catch (err) {
      this.logger?.warn("RedisCache.set failed, value was not cached", { key, err });
    }
  }

  private prefixed(key: string): string {
    return `${this.keyPrefix}${key}`;
  }
}
