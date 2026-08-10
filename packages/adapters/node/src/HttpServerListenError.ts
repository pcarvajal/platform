import { AdapterError } from "@platform/core";

// Raised by `NodeHttpServer` when the underlying `http.Server` emits `"error"` while trying to
// bind to `port` (e.g. `EADDRINUSE`, `EACCES`) instead of completing `listen()` normally.
export class HttpServerListenError extends AdapterError {
  readonly type = "HttpServerListenError";

  constructor(
    public readonly port: number,
    cause: unknown,
  ) {
    super("@platform/adapter-node", `Failed to start listening on port ${port}.`, { cause });
  }
}
