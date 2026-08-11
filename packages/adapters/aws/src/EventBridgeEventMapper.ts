import { PlatformError } from "@platform/core";
import type { MessageEnvelope } from "@platform/infrastructure";
import type { EventBridgeEvent } from "aws-lambda";
import { MalformedEventBridgeEventError } from "./MalformedEventBridgeEventError.js";

// EventBridge invoca el Lambda con un solo evento por invocación (a diferencia de SQS, que
// entrega en batch) — igual se devuelve un array de un elemento para que createMessageDispatcher
// use la misma forma en ambos ejes.
export function mapEventBridgeEvent(event: EventBridgeEvent<string, unknown>): MessageEnvelope[] {
  try {
    return [
      {
        id: event.id,
        source: event.source,
        receivedAt: new Date(event.time),
        attributes: { "detail-type": event["detail-type"], region: event.region },
        body: event.detail,
      },
    ];
  } catch (err) {
    if (err instanceof PlatformError) throw err;
    throw new MalformedEventBridgeEventError(err);
  }
}
