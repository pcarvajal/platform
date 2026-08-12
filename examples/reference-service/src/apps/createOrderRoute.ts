import { parseJsonBody, route, type HttpRoute } from "@platform/infrastructure";
import { z } from "zod";
import type { CreateOrder } from "../core/application/CreateOrder.js";

const CreateOrderBody = z.object({
  customerId: z.string(),
  items: z.array(z.string()).min(1),
});

export const createOrderRoute = (createOrder: CreateOrder): HttpRoute => ({
  method: "POST",
  path: "/orders",
  handle: route(createOrder, (request) => parseJsonBody(request, CreateOrderBody), {
    successStatusCode: 201,
  }),
});
