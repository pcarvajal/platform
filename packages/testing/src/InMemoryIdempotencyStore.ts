import type { IdempotencyStore } from "@platform/infrastructure";

/**
 * `IdempotencyStore` double backed by a `Set` — no TTL enforcement. For a test that only needs
 * "does hasProcessed/markProcessed work", not for exercising a real store's expiry behavior.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly processed = new Set<string>();

  async hasProcessed(key: string): Promise<boolean> {
    return this.processed.has(key);
  }

  async markProcessed(key: string): Promise<void> {
    this.processed.add(key);
  }
}
