import type { ApplicationResult } from "@platform/core";
import type { MessageEnvelope } from "./MessageEnvelope.js";

// Simétrico a HttpRoute para el eje de mensajería. `matches` decide si esta ruta maneja un
// envelope dado; `handle` corre el UseCase correspondiente y devuelve su ApplicationResult, igual
// que un HttpRoute["handle"] antes de pasar por toHttpResponse.
export interface MessageRoute<TBody = unknown> {
  matches: (envelope: MessageEnvelope) => boolean;
  handle: (envelope: MessageEnvelope<TBody>) => Promise<ApplicationResult<unknown>>;
}

// Forma por defecto de `matches`: una ruta por cola/tópico (el `source` del envelope) — cubre el
// caso común sin necesitar un router de pattern-matching genérico que hoy no tiene un segundo caso
// real que lo justifique (ver SKILL.md § Cuándo SÍ/NO crear una abstracción).
export const bySource =
  (source: string): MessageRoute["matches"] =>
  (envelope) =>
    envelope.source === source;
