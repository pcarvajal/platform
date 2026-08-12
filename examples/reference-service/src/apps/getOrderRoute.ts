import {
  parsePathParams,
  route,
  withHttpCache,
  type HttpResponseCache,
  type HttpRoute,
} from "@platform/infrastructure";
import { z } from "zod";
import type { GetOrder } from "../core/application/GetOrder.js";

const GetOrderPathParams = z.object({ id: z.string() });

// `cache` es opcional — composición manual sobre una HttpRoute puntual (ver references/http.md §
// withHttpCache), en vez de forzar un HttpResponseCache real en todo entorno. En
// infrastructure/deployment/local/server.ts solo se pasa si REDIS_URL está configurada; sin eso,
// este endpoint no cachea nada y sigue funcionando exactamente igual.
export const getOrderRoute = (getOrder: GetOrder, cache?: HttpResponseCache): HttpRoute => {
  const handle = route(getOrder, (request) => {
    const { id } = parsePathParams(request, GetOrderPathParams);
    return { orderId: id };
  });
  return {
    method: "GET",
    path: "/orders/:id",
    handle: cache ? withHttpCache(handle, cache, { ttlSeconds: 30 }) : handle,
  };
};
