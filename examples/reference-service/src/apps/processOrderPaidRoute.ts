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

// El ARN/nombre real de la cola en un proyecto AWS (ver adapter-aws createSqsMessageHandler) —
// en este ejemplo local no hay una cola real, ver infrastructure/deployment/local/demoConsumer.ts.
export const PROCESS_ORDER_PAID_SOURCE = "orders-paid-queue";

export const processOrderPaidRoute = (
  processOrderPaid: ProcessOrderPaid,
  idempotencyStore: IdempotencyStore,
): MessageRoute => ({
  matches: bySource(PROCESS_ORDER_PAID_SOURCE),
  handle: withIdempotency(
    (envelope) => processOrderPaid.execute(envelope.body as ProcessOrderPaidCommand),
    idempotencyStore,
  ),
});
