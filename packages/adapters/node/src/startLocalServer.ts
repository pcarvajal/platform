import type { IncomingMessage } from "node:http";
import type { HttpRoute } from "@platform/infrastructure";
import { createHttpDispatcher, HttpRouter } from "@platform/infrastructure";
import { NodeHttpRequestMapper } from "./NodeHttpRequestMapper.js";
import { NodeHttpServer } from "./NodeHttpServer.js";

export type StartLocalServerOptions = {
  port: number;
};

/**
 * Wires HttpRouter + NodeHttpRequestMapper + createHttpDispatcher + NodeHttpServer for the
 * common case (single local HTTP server, default Node request mapping) and starts listening.
 * For anything that needs a different mapper or dispatcher, compose those pieces by hand instead.
 */
export async function startLocalServer(
  routes: HttpRoute[],
  options: StartLocalServerOptions,
): Promise<NodeHttpServer> {
  const router = new HttpRouter(routes);
  const mapper = new NodeHttpRequestMapper();
  const dispatch = createHttpDispatcher(
    (req: IncomingMessage) => mapper.map(req),
    router.dispatch,
  );

  const server = new NodeHttpServer(dispatch, router.describe());
  await server.listen(options.port);
  return server;
}
