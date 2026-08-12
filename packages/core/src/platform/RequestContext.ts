import { randomUUID } from "node:crypto";

// Id de correlación end-to-end: generado una sola vez por request/mensaje entrante
// (createHttpDispatcher, o el `id` de un MessageEnvelope) y propagado explícitamente —
// `execute(command, context)`, `Logger.bind(context)`, `RestClientOptions.context` — nunca vía
// AsyncLocalStorage implícito (ver SKILL.md § Filosofía).
export interface RequestContext {
  requestId: string;
  traceId?: string;
  timestamp: Date;
}

export function createRequestContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    requestId: overrides.requestId ?? randomUUID(),
    timestamp: overrides.timestamp ?? new Date(),
    ...(overrides.traceId !== undefined && { traceId: overrides.traceId }),
  };
}
