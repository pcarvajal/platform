export type ResponseMeta = {
  statusCode: number;
};

export type RestClientOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
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
