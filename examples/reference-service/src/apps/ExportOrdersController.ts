import { createRequestContext, matchApplicationResult } from "@platform/core";
import {
  parseQueryParams,
  toHttpResponse,
  type HttpRequest,
  type HttpResponse,
} from "@platform/infrastructure";
import { z } from "zod";
import type { ListOrders } from "../core/application/ListOrders.js";
import type { OrderScalars } from "../core/domain/Order.js";
import { OrderStatusVO } from "../core/domain/OrderStatus.js";

const ExportOrdersQuery = z.object({ status: z.string().optional() });

// Tope duro de filas: este endpoint no pagina (un CSV parcial no le sirve a nadie), así que la
// única protección contra exportar una tabla entera es este límite explícito.
const MAX_EXPORT_ROWS = 1000;

const CSV_HEADERS: ReadonlyArray<[string, string]> = [
  ["Content-Type", "text/csv; charset=utf-8"],
  ["Content-Disposition", 'attachment; filename="orders.csv"'],
];

const CSV_COLUMNS = ["id", "customerId", "items", "status"] as const;

// Controller-clase de verdad (una clase con `handle`, references/usecase.md § "Forma manual"), no
// una función que devuelve un HttpRoute como el resto de apps/: la respuesta no es el envelope
// JSON de `ok()` sino un CSV con Content-Type/Content-Disposition propios, y `route()` siempre
// pasa por toHttpResponse (que fija `application/json` y serializa `{ data }`). Es también la
// forma que mejor encaja con una Lambda dedicada a un solo endpoint, que no necesita HttpRouter
// — ver infrastructure/deployment/aws/exportOrdersHandler.ts.
export class ExportOrdersController {
  constructor(private readonly listOrders: ListOrders) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const { status } = parseQueryParams(request, ExportOrdersQuery);
    // Mismo criterio que apps/listOrdersRoute.ts: el set cerrado de estados vive en domain, no
    // duplicado en el schema de zod — un status inválido tira InvalidArgumentError (400).
    const validatedStatus = status ? new OrderStatusVO(status).value : undefined;

    // Equivalente explícito de lo que route() hace por dentro (references/usecase.md §
    // "Propagación de RequestContext"), porque acá no hay route() que lo arme.
    const context = createRequestContext({ requestId: request.requestId });
    const result = await this.listOrders.execute(
      { page: 1, pageSize: MAX_EXPORT_ROWS, status: validatedStatus },
      context,
    );

    return matchApplicationResult(result, {
      onSuccess: ({ items, total }): HttpResponse => ({
        statusCode: 200,
        // `total` es el total sin truncar: si supera MAX_EXPORT_ROWS, el header lo delata aunque
        // el cuerpo traiga menos filas.
        headers: new Map([...CSV_HEADERS, ["X-Total-Count", String(total)]]),
        body: toCsv(items),
      }),
      // El error sí vuelve como JSON — un cliente que recibe un 4xx/5xx no está parseando el CSV.
      onError: (error) => toHttpResponse({ ok: false, error }),
    });
  }
}

function toCsv(orders: OrderScalars[]): string {
  const rows = orders.map((order) =>
    [order.id, order.customerId, order.items.join(" "), order.status].map(escapeCsv).join(","),
  );
  return [CSV_COLUMNS.join(","), ...rows].join("\n");
}

function escapeCsv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
