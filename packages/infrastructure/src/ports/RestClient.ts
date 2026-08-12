import type { RequestContext } from "@platform/core";

export type ResponseMeta = {
  statusCode: number;
};

export type RestClientOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  // Si se pasa, una implementación de RestClient debe propagar el id de correlación (y el
  // traceId, si hay) en la llamada saliente — ver NodeFetchRestClient para la forma de
  // referencia (headers `x-request-id`/`traceparent`).
  context?: RequestContext;
};

export interface RestClient {
  get: <T extends object>(
    url: string,
    options?: RestClientOptions,
  ) => Promise<{ data: T; meta: ResponseMeta }>;
  post: <T extends object>(
    url: string,
    params: object,
    options?: RestClientOptions,
  ) => Promise<{ data: T; meta: ResponseMeta }>;
  put: <T extends object>(
    url: string,
    params: object,
    options?: RestClientOptions,
  ) => Promise<{ data: T; meta: ResponseMeta }>;
  delete: <T extends object>(
    url: string,
    params: object,
    options?: RestClientOptions,
  ) => Promise<{ data: T; meta: ResponseMeta }>;
}
