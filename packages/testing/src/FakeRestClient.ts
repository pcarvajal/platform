import type { ResponseMeta, RestClient, RestClientOptions } from "@platform/infrastructure";

export type RecordedCall = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  params?: object;
  options?: RestClientOptions;
};

type QueuedResponse = { data: unknown; meta?: ResponseMeta } | { error: unknown };

/**
 * `RestClient` double: records every call (`fakeRestClient.calls`) and resolves them in order
 * against a queue of pre-programmed responses (`respondWith`/`respondWithError`) — so a `UseCase`
 * that depends on `RestClient` is testable without a real upstream, the same way `InMemoryRepository`
 * removes the need for a real DB.
 */
export class FakeRestClient implements RestClient {
  readonly calls: RecordedCall[] = [];
  private readonly queue: QueuedResponse[] = [];

  respondWith(data: unknown, meta: ResponseMeta = { statusCode: 200 }): void {
    this.queue.push({ data, meta });
  }

  respondWithError(error: unknown): void {
    this.queue.push({ error });
  }

  async get<T extends object>(
    url: string,
    options?: RestClientOptions,
  ): Promise<{ data: T; meta: ResponseMeta }> {
    return this.resolve<T>("GET", url, undefined, options);
  }

  async post<T extends object>(
    url: string,
    params: object,
    options?: RestClientOptions,
  ): Promise<{ data: T; meta: ResponseMeta }> {
    return this.resolve<T>("POST", url, params, options);
  }

  async put<T extends object>(
    url: string,
    params: object,
    options?: RestClientOptions,
  ): Promise<{ data: T; meta: ResponseMeta }> {
    return this.resolve<T>("PUT", url, params, options);
  }

  async delete<T extends object>(
    url: string,
    params: object,
    options?: RestClientOptions,
  ): Promise<{ data: T; meta: ResponseMeta }> {
    return this.resolve<T>("DELETE", url, params, options);
  }

  private async resolve<T extends object>(
    method: RecordedCall["method"],
    url: string,
    params: object | undefined,
    options: RestClientOptions | undefined,
  ): Promise<{ data: T; meta: ResponseMeta }> {
    this.calls.push({ method, url, params, options });

    const next = this.queue.shift();
    if (!next) {
      throw new Error(`FakeRestClient: no response queued for ${method} ${url}`);
    }
    if ("error" in next) throw next.error;
    return { data: next.data as T, meta: next.meta ?? { statusCode: 200 } };
  }
}
