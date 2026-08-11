import type { ApplicationResult } from "@platform/core";
import { toApplicationSuccess } from "@platform/core";
import type { IdempotencyStore } from "../ports/IdempotencyStore.js";
import type { MessageEnvelope } from "./MessageEnvelope.js";

export type WithIdempotencyOptions = {
  ttlSeconds?: number;
  keyBuilder?: (envelope: MessageEnvelope) => string;
};

const defaultKeyBuilder = (envelope: MessageEnvelope): string => envelope.id;

// Envuelve un MessageRoute["handle"]: en un hit (key ya procesada) devuelve éxito sin volver a
// ejecutar `handle`; en un miss lo ejecuta y solo marca la key como procesada si terminó en éxito
// — un fallo debe poder reintentarse en la próxima entrega. Mismo patrón de composición que
// withHttpCache sobre HttpRoute["handle"].
export function withIdempotency<TBody>(
  handle: (envelope: MessageEnvelope<TBody>) => Promise<ApplicationResult<unknown>>,
  store: IdempotencyStore,
  options: WithIdempotencyOptions = {},
): (envelope: MessageEnvelope<TBody>) => Promise<ApplicationResult<unknown>> {
  const keyBuilder = options.keyBuilder ?? defaultKeyBuilder;

  return async (envelope) => {
    const key = keyBuilder(envelope);
    if (await store.hasProcessed(key)) {
      return toApplicationSuccess(undefined);
    }

    const result = await handle(envelope);
    if (result.ok) {
      await store.markProcessed(key, options.ttlSeconds);
    }
    return result;
  };
}
