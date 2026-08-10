import { AdapterError } from "@platform/core";

// Raised by `NodeHttpRequestMapper` when the incoming `IncomingMessage` stream emits `"error"`
// while its body is being read (e.g. the client aborts the connection mid-upload). Distinct from
// `MalformedHttpRequestError`, which covers a request whose shape can't be parsed at all.
export class HttpRequestStreamError extends AdapterError {
  readonly type = "HttpRequestStreamError";

  constructor(cause: unknown) {
    super("@platform/adapter-node", "Failed while reading the incoming HTTP request body.", {
      cause,
    });
  }
}
