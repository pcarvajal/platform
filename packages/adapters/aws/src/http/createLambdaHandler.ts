import type { HttpResponse, HttpRoute } from "@platform/infrastructure";
import { createHttpDispatcher, HttpRouter } from "@platform/infrastructure";
import type { AWSApiGatewayEvent } from "./AWSApiGatewayEventHttpMapper.js";
import { AWSApiGatewayEventHttpMapper } from "./AWSApiGatewayEventHttpMapper.js";

/**
 * Wires HttpRouter + AWSApiGatewayEventHttpMapper + createHttpDispatcher for the common case
 * (a Lambda behind API Gateway, default AWS request mapping) into a ready-to-export handler.
 * For anything that needs a different mapper or dispatcher, compose those pieces by hand instead.
 */
export function createLambdaHandler(
  routes: HttpRoute[],
): (event: AWSApiGatewayEvent) => Promise<HttpResponse> {
  const router = new HttpRouter(routes);
  const mapper = new AWSApiGatewayEventHttpMapper();
  return createHttpDispatcher((event: AWSApiGatewayEvent) => mapper.map(event), router.dispatch);
}
