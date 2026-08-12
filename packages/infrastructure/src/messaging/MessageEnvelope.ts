// Forma normalizada de un mensaje entrante (SQS, EventBridge, cualquier broker), simétrica a
// HttpRequest para el eje HTTP — ver references/http.md § HttpRequest.
export interface MessageEnvelope<TBody = unknown> {
  id: string;
  source: string;
  receivedAt: Date;
  attributes: Record<string, string>;
  body: TBody;
}
