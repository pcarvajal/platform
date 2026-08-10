import { ResponseMeta, RestClient, RestClientOptions } from "@platform/infrastructure";
import { UpstreamServiceError, UpstreamTimeoutError } from "@platform/core";

export type NodeFetchRestClientConfig = {
  baseURL?: string;
  defaultHeaders?: Record<string, string>;
  defaultTimeoutMs?: number;
};

async function parseErrorBody(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && err.name === "TimeoutError";
}

export class NodeFetchRestClient implements RestClient {
  constructor(private readonly config: NodeFetchRestClientConfig = {}) {}

  async delete<T>(
    url: string,
    params: object,
    options?: RestClientOptions,
  ): Promise<{ data: T; meta: ResponseMeta }> {
    return this.request<T>("DELETE", url, params, options);
  }

  async get<T>(url: string, options?: RestClientOptions): Promise<{ data: T; meta: ResponseMeta }> {
    return this.request<T>("GET", url, undefined, options);
  }

  async post<T>(
    url: string,
    params: object,
    options?: RestClientOptions,
  ): Promise<{ data: T; meta: ResponseMeta }> {
    return this.request<T>("POST", url, params, options);
  }

  async put<T>(
    url: string,
    params: object,
    options?: RestClientOptions,
  ): Promise<{ data: T; meta: ResponseMeta }> {
    return this.request<T>("PUT", url, params, options);
  }

  private resolveUrl(url: string): string {
    if (!this.config.baseURL) return url;
    return new URL(url, this.config.baseURL).toString();
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    params: object | undefined,
    options?: RestClientOptions,
  ): Promise<{ data: T; meta: ResponseMeta }> {
    const resolvedUrl = this.resolveUrl(url);
    const headers = { ...this.config.defaultHeaders, ...options?.headers };
    const timeoutMs = options?.timeoutMs ?? this.config.defaultTimeoutMs;

    const isForm = headers["Content-Type"] === "application/x-www-form-urlencoded;charset=UTF-8";
    const body =
      params === undefined
        ? undefined
        : isForm
          ? new URLSearchParams(params as Record<string, string>)
          : JSON.stringify(params);

    let response: Response;
    try {
      response = await fetch(resolvedUrl, {
        method,
        headers,
        body,
        signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
      });
    } catch (err) {
      if (isTimeout(err)) {
        throw new UpstreamTimeoutError(
          `Timeout in ${method} request to ${resolvedUrl}`,
          { method, url: resolvedUrl, timeoutMs },
          err,
        );
      }
      throw new UpstreamServiceError(
        `Network error in ${method} request to ${resolvedUrl}: ${err instanceof Error ? err.message : String(err)}`,
        { method, url: resolvedUrl },
        err,
      );
    }

    if (response.ok) {
      try {
        return { data: (await response.json()) as T, meta: { statusCode: response.status } };
      } catch (err) {
        throw new UpstreamServiceError(
          `Invalid JSON response in ${method} request to ${resolvedUrl}`,
          { method, url: resolvedUrl, statusCode: response.status },
          err,
        );
      }
    }

    const errorBody = await parseErrorBody(response);
    throw new UpstreamServiceError(`Error in ${method} request: ${response.status}`, {
      method,
      url: resolvedUrl,
      statusCode: response.status,
      body: errorBody,
    });
  }
}
