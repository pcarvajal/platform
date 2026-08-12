import type { IncomingMessage } from "node:http";
import { PlatformError } from "@platform/core";
import type { HttpMethod, HttpRequest } from "@platform/infrastructure";
import { HttpRequestMapper } from "@platform/infrastructure";
import { HttpRequestStreamError } from "./HttpRequestStreamError.js";
import { MalformedHttpRequestError } from "./MalformedHttpRequestError.js";

export class NodeHttpRequestMapper extends HttpRequestMapper<IncomingMessage> {
  override map(req: IncomingMessage): Promise<HttpRequest> {
    return new Promise((resolve, reject) => {
      let url: URL;
      let queryParams: Record<string, string | undefined>;
      let headers: Record<string, string | undefined>;
      try {
        const rawUrl = req.url ?? "/";
        url = new URL(rawUrl, "http://localhost");

        queryParams = {};
        url.searchParams.forEach((value, key) => {
          queryParams[key] = value;
        });

        headers = {};
        for (const [key, value] of Object.entries(req.headers)) {
          if (typeof value === "string") headers[key] = value;
          else if (Array.isArray(value)) headers[key] = value[0];
        }
      } catch (err) {
        reject(err instanceof PlatformError ? err : new MalformedHttpRequestError(err));
        return;
      }

      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        const rawBody = chunks.length > 0 ? Buffer.concat(chunks).toString("utf-8") : null;
        resolve({
          method: (req.method ?? "GET") as HttpMethod,
          path: url.pathname,
          pathParams: {},
          queryParams,
          headers,
          rawBody,
        });
      });
      req.on("error", (err) => reject(new HttpRequestStreamError(err)));
    });
  }
}
