import {
  createMessageDispatcher,
  type MessageDispatchResult,
  type MessageRoute,
} from "@platform/infrastructure";
import type { EventBridgeEvent } from "aws-lambda";
import { EventBridgeDispatchError } from "./EventBridgeDispatchError.js";
import { mapEventBridgeEvent } from "./mapEventBridgeEvent.js";

// A diferencia de createSqsMessageHandler, acá un ApplicationResult con `ok: false` se traduce a
// una excepción — es la única forma de que el retry policy nativo de EventBridge/Lambda actúe,
// dado que no existe un equivalente a `batchItemFailures` para este trigger.
export function createEventBridgeMessageHandler(
  routes: MessageRoute[],
): (event: EventBridgeEvent<string, unknown>) => Promise<void> {
  return createMessageDispatcher(mapEventBridgeEvent, routes, throwOnFailure);
}

function throwOnFailure(results: MessageDispatchResult[]): void {
  const failed = results.find(({ result }) => !result.ok);
  if (failed && !failed.result.ok) throw new EventBridgeDispatchError(failed.result.error);
}
