import { PlatformError } from "@platform/core";
import type { MessageEnvelope } from "@platform/infrastructure";
import type { SQSEvent, SQSRecord } from "aws-lambda";
import { MalformedSqsEventError } from "./MalformedSqsEventError.js";

// Mapea el evento nativo de Lambda-desde-SQS a MessageEnvelope[], análogo a
// AWSApiGatewayEventHttpMapper para HTTP. `source` es el ARN de la cola (eventSourceARN) — la
// forma por defecto de MessageRoute["matches"] (bySource, @platform/infrastructure) matchea
// contra eso.
export function mapSqsEvent(event: SQSEvent): MessageEnvelope[] {
  try {
    return event.Records.map(toEnvelope);
  } catch (err) {
    if (err instanceof PlatformError) throw err;
    throw new MalformedSqsEventError(err);
  }
}

function toEnvelope(record: SQSRecord): MessageEnvelope {
  return {
    id: record.messageId,
    source: record.eventSourceARN,
    receivedAt: new Date(Number(record.attributes.SentTimestamp)),
    attributes: Object.fromEntries(
      Object.entries(record.messageAttributes ?? {}).map(([key, value]) => [
        key,
        value.stringValue ?? "",
      ]),
    ),
    body: JSON.parse(record.body) as unknown,
  };
}
