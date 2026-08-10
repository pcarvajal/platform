import { AdapterError } from "@platform/core";

export class MalformedApiGatewayEventError extends AdapterError {
  readonly type = "MalformedApiGatewayEventError";

  constructor(cause: unknown) {
    super(
      "@platform/adapter-aws",
      "Received an event that doesn't match APIGatewayProxyEvent/APIGatewayProxyEventV2. " +
        "Verify this Lambda is wired to an API Gateway HTTP or REST API trigger and that no " +
        "other service (e.g. an ALB or a direct invoke) is calling it with a different payload shape.",
      { cause },
    );
  }
}
