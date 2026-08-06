export interface HttpServer {
  listen(port: number): Promise<void>;
  close(): Promise<void>;
}
