import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type {
  HttpResponse,
  HttpServer,
} from "@platform/infrastructure";
import { HttpServerCloseError } from "./HttpServerCloseError.js";
import { HttpServerListenError } from "./HttpServerListenError.js";

type Dispatch = (req: IncomingMessage) => Promise<HttpResponse>;

export class NodeHttpServer implements HttpServer {
  private server: Server | null = null;

  constructor(
    private readonly dispatch: Dispatch,
    private readonly routes: string[] = [],
  ) {}

  listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer(async (req, res) => {
        const httpResponse = await this.dispatch(req);
        this.writeResponse(res, httpResponse);
      });
      this.server.once("error", (err) => reject(new HttpServerListenError(port, err)));
      this.server.listen(port, () => {
        console.info(`[local] HTTP server listening on http://localhost:${port}`);
        for (const route of this.routes) {
          console.info(`[local]   ${route}`);
        }
        resolve();
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) return resolve();
      this.server.close((err) => (err ? reject(new HttpServerCloseError(err)) : resolve()));
    });
  }

  private writeResponse(res: ServerResponse, httpResponse: HttpResponse): void {
    httpResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    res.writeHead(Number(httpResponse.statusCode));
    res.end(httpResponse.body);
  }
}
