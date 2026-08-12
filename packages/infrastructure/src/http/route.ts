import { createRequestContext, type UseCase } from "@platform/core";
import type { HttpRequest } from "./HttpRequest.js";
import type { HttpRoute } from "./HttpRoute.js";
import { toHttpResponse } from "./toHttpResponse.js";

// Forma por defecto de un HttpRoute["handle"] para el caso común: un UseCase por endpoint, sin
// lógica de mapeo especial. Un controller-clase manual sigue siendo el camino correcto cuando hace
// falta algo más (headers custom, side effects antes/después) — ver SKILL.md § apps/.
export function route<TCommand, TData>(
  useCase: UseCase<TCommand, TData>,
  mapRequest: (request: HttpRequest) => TCommand,
  options?: { successStatusCode?: number },
): HttpRoute["handle"] {
  return async (request) => {
    // request.requestId siempre está presente acá (createHttpDispatcher lo garantiza) — el
    // fallback a createRequestContext() sin overrides solo aplica si route() se llama por fuera
    // del dispatcher (p. ej. un test que invoca el handle directo).
    const context = createRequestContext({ requestId: request.requestId });
    return toHttpResponse(await useCase.execute(mapRequest(request), context), options);
  };
}
