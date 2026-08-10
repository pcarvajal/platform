import type { Cache } from "@platform/infrastructure";

/**
 * `Cache<T>` double backed by a `Map` — no TTL enforcement, no serialization, no failure modes.
 * For a use case that only needs "does get/set work", not for exercising Redis-specific behavior
 * (TTL expiry, degrading to a miss on failure) — that's what `RedisCache` itself is for.
 */
export class InMemoryCache<T> implements Cache<T> {
  private readonly store = new Map<string, T>();

  async get(key: string): Promise<T | undefined> {
    return this.store.get(key);
  }

  async set(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }
}
