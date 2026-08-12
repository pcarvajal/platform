import type { MessageEnvelope } from "@platform/infrastructure";
import { randomUUID } from "node:crypto";

/**
 * Builds a valid `MessageEnvelope` with sane defaults so a `MessageRoute`/consumer test only has
 * to specify the fields it actually cares about, instead of the full shape every time.
 */
export function buildMessageEnvelope<TBody = unknown>(
  overrides: Partial<MessageEnvelope<TBody>> = {},
): MessageEnvelope<TBody> {
  return {
    id: randomUUID(),
    source: "test-source",
    receivedAt: new Date(),
    attributes: {},
    body: undefined as TBody,
    ...overrides,
  };
}
