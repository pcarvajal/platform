import {
  bySource,
  withIdempotency,
  type IdempotencyStore,
  type MessageRoute,
} from "@platform/infrastructure";
import type {
  ProcessOrderPaid,
  ProcessOrderPaidCommand,
} from "../core/application/ProcessOrderPaid.js";

// Nombre por defecto para el demo local (ver infrastructure/deployment/local/demoConsumer.ts) —
// en AWS, `source` es el ARN real de la cola (ver adapter-aws mapSqsEvent, que lo completa con
// `record.eventSourceARN`), pasado explícito desde infrastructure/deployment/aws/orderPaidConsumer.ts
// vía el tercer parámetro en vez de este default.
export const PROCESS_ORDER_PAID_SOURCE = "orders-paid-queue";

export const processOrderPaidRoute = (
  processOrderPaid: ProcessOrderPaid,
  idempotencyStore: IdempotencyStore,
  source: string = PROCESS_ORDER_PAID_SOURCE,
): MessageRoute => ({
  matches: bySource(source),
  handle: withIdempotency(
    (envelope) => processOrderPaid.execute(envelope.body as ProcessOrderPaidCommand),
    idempotencyStore,
  ),
});
