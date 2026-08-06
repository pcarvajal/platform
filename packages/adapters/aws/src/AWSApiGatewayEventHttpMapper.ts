import { PlatformError } from "@platform/core";
import type { HttpMethod, HttpRequest } from "@platform/infrastructure";
import { HttpRequestMapper } from "@platform/infrastructure";
import type { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from "aws-lambda";
import { MalformedApiGatewayEventError } from "./MalformedApiGatewayEventError.js";

export type AWSApiGatewayEvent = APIGatewayProxyEventV2 | APIGatewayProxyEvent;

export class AWSApiGatewayEventHttpMapper extends HttpRequestMapper<AWSApiGatewayEvent> {
  override map(event: AWSApiGatewayEvent): Promise<HttpRequest> {
    try {
      if (this.isEventV2(event)) {
        const v2: HttpRequest = {
          method: event.requestContext.http.method as HttpMethod,
          path: event.rawPath,
          pathParams: event.pathParameters ?? {},
          queryParams: event.queryStringParameters ?? {},
          headers: event.headers,
          rawBody: event.body ?? null,
        };

        return Promise.resolve(v2);
      }

      return Promise.resolve({
        method: event.requestContext.httpMethod as HttpMethod,
        path: event.path,
        pathParams: event.pathParameters ?? {},
        queryParams: event.queryStringParameters ?? {},
        headers: event.headers,
        rawBody: event.body ?? null,
      });
    } catch (err) {
      if (err instanceof PlatformError) throw err;
      throw new MalformedApiGatewayEventError(err);
    }
  }

  isEventV2(event: AWSApiGatewayEvent): event is APIGatewayProxyEventV2 {
    return "rawPath" in event;
  }
}
