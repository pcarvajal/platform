import { createRequestContext, matchApplicationResult } from "@platform/core";
import {
  ConflictError,
  parsePathParams,
  toHttpResponse,
  UnprocessableEntityError,
  type HttpRoute,
} from "@platform/infrastructure";
import { z } from "zod";
import type { ShipOrder } from "../core/application/ShipOrder.js";

const ShipOrderPathParams = z.object({ id: z.string() });

// Controller-clase manual (references/usecase.md § "Forma manual") en vez de route(): los dos
// errores de negocio de ShipOrder (OrderAlreadyShippedError, OrderNotPaidError) no tienen entrada
// en HTTP_ERROR_BY_APPLICATION_ERROR_TYPE (infrastructure/http/toHttpResponse.ts) — sin este
// controller, ambos caerían en 500 vía el fallback genérico. matchApplicationResult evita el
// if/else repetido para separar esos dos casos del resto (que sí delega en toHttpResponse).
export const shipOrderRoute = (shipOrder: ShipOrder): HttpRoute => ({
  method: "POST",
  path: "/orders/:id/ship",
  handle: async (request) => {
    const { id } = parsePathParams(request, ShipOrderPathParams);
    // Igual que route() (ver references/usecase.md § "Propagación de RequestContext"), pero
    // explícito porque este endpoint necesita más que "parsear, ejecutar, traducir".
    const context = createRequestContext({ requestId: request.requestId });
    const result = await shipOrder.execute({ orderId: id }, context);

    return matchApplicationResult(result, {
      onSuccess: (data) => toHttpResponse({ ok: true, data }),
      onError: (error) => {
        if (error.type === "OrderAlreadyShippedError") {
          throw new ConflictError(error.message, error.data);
        }
        if (error.type === "OrderNotPaidError") {
          throw new UnprocessableEntityError(error.message, error.data);
        }
        return toHttpResponse({ ok: false, error });
      },
    });
  },
});
