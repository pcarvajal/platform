// SQS/EventBridge son at-least-once — un mismo mensaje puede reentregarse. Puerto
// tecnología-agnóstico para deduplicar el procesamiento, mismo patrón que Cache<T>/RestClient:
// contrato acá, implementación concreta en un adapter (ver InMemoryIdempotencyStore en
// @platform/testing).
export interface IdempotencyStore {
  hasProcessed(key: string): Promise<boolean>;
  markProcessed(key: string, ttlSeconds?: number): Promise<void>;
}
