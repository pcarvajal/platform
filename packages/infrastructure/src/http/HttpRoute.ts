import { HttpMethod } from "./HttpMethod.js";
import { HttpRequest } from "./HttpRequest.js";
import { HttpResponse } from "./HttpResponse.js";

export interface HttpRoute {
  method: HttpMethod;
  path: string;
  handle: (request: HttpRequest) => Promise<HttpResponse>;
}
