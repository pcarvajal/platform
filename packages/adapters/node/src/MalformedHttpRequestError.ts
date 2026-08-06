import { AdapterError } from "@platform/core";

// Raised by `NodeHttpRequestMapper` when it can't turn an incoming `IncomingMessage` into an
// `HttpRequest` (e.g. an unparsable URL). Being an `AdapterError` (a `PlatformError`) marks this
// as coming from this package rather than from the app using it, and `cause` keeps the original
// error.
export class MalformedHttpRequestError extends AdapterError {
  type = "MalformedHttpRequestError";

  constructor(cause: unknown) {
    super(
      "@platform/adapter-node",
      "Failed to parse the incoming HTTP request.",
      {
        cause,
      },
    );
  }
}
