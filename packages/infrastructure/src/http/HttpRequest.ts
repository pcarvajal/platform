import type { HttpMethod } from "./HttpMethod.js";

export interface HttpRequest {
  method: HttpMethod;
  path: string;
  pathParams: Record<string, string | undefined>;
  queryParams: Record<string, string | undefined>;
  headers: Record<string, string | undefined>;
  rawBody: string | null;
  // Opcional porque los HttpRequestMapper no lo asignan — createHttpDispatcher lo completa una
  // sola vez (de un header `x-request-id` entrante, o generado) antes de invocar la ruta, así que
  // por el tiempo que un HttpRoute["handle"]/route() lo recibe siempre está presente.
  requestId?: string;
}
