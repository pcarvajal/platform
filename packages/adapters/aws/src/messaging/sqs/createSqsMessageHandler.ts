import {
  createMessageDispatcher,
  type MessageDispatchResult,
  type MessageRoute,
} from "@platform/infrastructure";
import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { mapSqsEvent } from "./mapSqsEvent.js";

// Wires createMessageDispatcher + mapSqsEvent + la respuesta de fallos parciales que SQS espera
// (batchItemFailures) en un handler listo para exportar — mismo espíritu que createLambdaHandler
// para HTTP. Un ítem cuyo ApplicationResult es `ok: false` se reporta como fallo de ese mensaje
// puntual, así que SQS solo reintenta/DLQ-ea ese ítem, no todo el batch.
export function createSqsMessageHandler(
  routes: MessageRoute[],
): (event: SQSEvent) => Promise<SQSBatchResponse> {
  return createMessageDispatcher(mapSqsEvent, routes, toBatchResponse);
}

function toBatchResponse(results: MessageDispatchResult[]): SQSBatchResponse {
  return {
    batchItemFailures: results
      .filter(({ result }) => !result.ok)
      .map(({ envelope }) => ({ itemIdentifier: envelope.id })),
  };
}
