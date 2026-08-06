import type { HttpRequest } from "./HttpRequest.js";

export abstract class HttpRequestMapper<T> {
  abstract map(httpRequest: T): Promise<HttpRequest>;
}
