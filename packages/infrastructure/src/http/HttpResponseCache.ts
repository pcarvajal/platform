import type { HttpResponse } from "./HttpResponse.js";

export interface HttpResponseCache {
  get(key: string): Promise<HttpResponse | undefined>;
  set(key: string, response: HttpResponse, ttlSeconds?: number): Promise<void>;
}
