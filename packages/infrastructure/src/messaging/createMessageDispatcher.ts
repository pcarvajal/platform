import { NotFoundError, toApplicationFailure, type ApplicationResult } from "@platform/core";
import type { MessageEnvelope } from "./MessageEnvelope.js";
import type { MessageRoute } from "./MessageRoute.js";

export type MessageDispatchResult = {
  envelope: MessageEnvelope;
  result: ApplicationResult<unknown>;
};

// Simétrico a createHttpDispatcher: mapea el evento crudo del proveedor a uno o más
// MessageEnvelope, ejecuta la MessageRoute que matchea cada uno, y deja que `toProviderResult`
// traduzca los resultados a la forma de respuesta que el proveedor espera (p. ej.
// `batchItemFailures` de SQS — ver @platform/adapter-aws). Un envelope sin ruta que lo maneje se
// trata como fallo de ese ítem (NotFoundError), no como excepción que tira todo el batch.
export function createMessageDispatcher<TRawEvent, TRawResult>(
  mapEnvelopes: (rawEvent: TRawEvent) => MessageEnvelope[],
  routes: MessageRoute[],
  toProviderResult: (results: MessageDispatchResult[]) => TRawResult,
): (rawEvent: TRawEvent) => Promise<TRawResult> {
  return async (rawEvent) => {
    const envelopes = mapEnvelopes(rawEvent);
    const results = await Promise.all(
      envelopes.map(async (envelope): Promise<MessageDispatchResult> => {
        const route = routes.find((candidate) => candidate.matches(envelope));
        const result = route
          ? await route.handle(envelope)
          : toApplicationFailure(
              new NotFoundError(`No matching MessageRoute for source "${envelope.source}"`),
            );
        return { envelope, result };
      }),
    );
    return toProviderResult(results);
  };
}
