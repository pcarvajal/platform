export interface HttpResponse {
  statusCode: number;
  headers: Map<string, string>;
  body: string;
}
