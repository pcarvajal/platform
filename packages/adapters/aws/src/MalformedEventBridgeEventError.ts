import { AdapterError } from "@platform/core";

export class MalformedEventBridgeEventError extends AdapterError {
  readonly type = "MalformedEventBridgeEventError";

  constructor(cause: unknown) {
    super(
      "@platform/adapter-aws",
      "Received an event that doesn't match EventBridgeEvent. Verify this Lambda is wired to an " +
        "EventBridge rule target.",
      { cause },
    );
  }
}
