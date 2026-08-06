import type { HttpMethod } from "./HttpMethod.js";

export interface HttpRequest {
  method: HttpMethod;
  path: string;
  pathParams: Record<string, string | undefined>;
  queryParams: Record<string, string | undefined>;
  headers: Record<string, string | undefined>;
  rawBody: string | null;
}
