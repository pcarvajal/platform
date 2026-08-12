import { matchApplicationResult } from "@platform/core";
import {
  parseQueryParams,
  toHttpResponse,
  type ApiResponse,
  type HttpRequest,
  type HttpResponse,
  type HttpRoute,
} from "@platform/infrastructure";
import { z } from "zod";
import type { ListOrders } from "../core/application/ListOrders.js";
import { OrderStatusVO } from "../core/domain/OrderStatus.js";
import type { OrderScalars } from "../core/domain/Order.js";

const ListOrdersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
});

const JSON_HEADERS = new Map([["Content-Type", "application/json"]]);

// Controller-clase manual (references/usecase.md § "Forma manual") en vez de route(): `ok()`
// (@platform/infrastructure, ver ports/ApiResponse.ts) solo acepta `data`/`meta`, no `pagination`
// — armar el body con ese campo puesto a mano es la única forma de exponerlo, así que route()
// (que siempre pasa por `ok()` vía toHttpResponse) no alcanza para este endpoint.
export const listOrdersRoute = (listOrders: ListOrders): HttpRoute => ({
  method: "GET",
  path: "/orders",
  handle: async (request: HttpRequest): Promise<HttpResponse> => {
    const { page, pageSize, status } = parseQueryParams(request, ListOrdersQuery);
    // Reutiliza el set cerrado de estados válidos de domain en vez de duplicarlo en el schema de
    // zod de arriba — un status inválido tira InvalidArgumentError (400 automático).
    const validatedStatus = status ? new OrderStatusVO(status).value : undefined;

    const result = await listOrders.execute({ page, pageSize, status: validatedStatus });

    return matchApplicationResult(result, {
      onSuccess: ({ items, total }): HttpResponse => {
        const body: ApiResponse<OrderScalars[]> = {
          data: items,
          pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 0 },
        };
        return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(body) };
      },
      onError: (error) => toHttpResponse({ ok: false, error }),
    });
  },
});
