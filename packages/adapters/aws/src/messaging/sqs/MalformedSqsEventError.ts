import { AdapterError } from "@platform/core";

export class MalformedSqsEventError extends AdapterError {
  readonly type = "MalformedSqsEventError";

  constructor(cause: unknown) {
    super(
      "@platform/adapter-aws",
      "Received an event that doesn't match SQSEvent, or a record body that isn't valid JSON. " +
        "Verify this Lambda is wired to an SQS trigger and that producers publish JSON bodies.",
      { cause },
    );
  }
}
