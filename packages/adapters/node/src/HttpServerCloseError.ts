import { AdapterError } from "@platform/core";

// Raised by `NodeHttpServer` when the underlying `http.Server#close` fails.
export class HttpServerCloseError extends AdapterError {
  readonly type = "HttpServerCloseError";

  constructor(cause: unknown) {
    super("@platform/adapter-node", "Failed to close the HTTP server.", {
      cause,
    });
  }
}
