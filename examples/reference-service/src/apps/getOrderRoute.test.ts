import type { HttpResponse } from "@platform/infrastructure";
import { buildHttpRequest, FakeLogger, InMemoryCache, InMemoryRepository } from "@platform/testing";
import { describe, expect, it } from "vitest";
import { GetOrder } from "../core/application/GetOrder.js";
import type { OrderRepository } from "../core/application/OrderRepository.js";
import { Order, type OrderId } from "../core/domain/Order.js";
import { getOrderRoute } from "./getOrderRoute.js";

// apps/ no puede importar infrastructure/ (ver SKILL.md § Dirección de dependencias) — ni siquiera
// en un test co-ubicado, así que este double se apoya en InMemoryRepository (@platform/testing, un
// paquete externo) en vez de `../infrastructure/persistence/InMemoryOrderRepository.js` real.
class TestOrderRepository implements OrderRepository {
  findByIdCalls = 0;
  private readonly repository = new (class extends InMemoryRepository<string, Order> {})();

  save(order: Order): Promise<void> {
    return this.repository.save(order);
  }
  findById(id: OrderId): Promise<Order | undefined> {
    this.findByIdCalls++;
    return this.repository.findById(id.value);
  }
  findAll(): Promise<Order[]> {
    return this.repository.findAll();
  }
}

describe("getOrderRoute", () => {
  it("returns 200 with the order on a known id", async () => {
    const orderRepository = new TestOrderRepository();
    const order = Order.create("customer-1", ["SKU-1"]);
    await orderRepository.save(order);
    const route = getOrderRoute(new GetOrder(orderRepository, new FakeLogger()));

    const response = await route.handle(
      buildHttpRequest({
        method: "GET",
        path: `/orders/${order.id.value}`,
        pathParams: { id: order.id.value },
      }),
    );

    expect(response.statusCode).toBe(200);
  });

  it("returns 404 for a well-formed id that doesn't exist, without a cache configured", async () => {
    const orderRepository = new TestOrderRepository();
    const route = getOrderRoute(new GetOrder(orderRepository, new FakeLogger()));
    const missingId = crypto.randomUUID();

    const response = await route.handle(
      buildHttpRequest({
        method: "GET",
        path: `/orders/${missingId}`,
        pathParams: { id: missingId },
      }),
    );

    expect(response.statusCode).toBe(404);
  });

  it("returns 400 for a malformed id — OrderId/Uuid validates the format before hitting the repository", async () => {
    const orderRepository = new TestOrderRepository();
    const route = getOrderRoute(new GetOrder(orderRepository, new FakeLogger()));

    const response = await route.handle(
      buildHttpRequest({
        method: "GET",
        path: "/orders/not-a-uuid",
        pathParams: { id: "not-a-uuid" },
      }),
    );

    expect(response.statusCode).toBe(400);
  });

  it("serves the second request from cache without hitting the repository again", async () => {
    const orderRepository = new TestOrderRepository();
    const order = Order.create("customer-1", ["SKU-1"]);
    await orderRepository.save(order);
    // InMemoryCache<T> (@platform/testing) estructuralmente satisface HttpResponseCache
    // (@platform/infrastructure): mismo get/set(key, value, ttlSeconds?) — igual que
    // RedisHttpResponseCache en producción, ver references/http.md § withHttpCache.
    const cache = new InMemoryCache<HttpResponse>();
    const route = getOrderRoute(new GetOrder(orderRepository, new FakeLogger()), cache);
    const request = buildHttpRequest({
      method: "GET",
      path: `/orders/${order.id.value}`,
      pathParams: { id: order.id.value },
    });

    const first = await route.handle(request);
    const second = await route.handle(request);

    expect(first.statusCode).toBe(200);
    expect(second.body).toBe(first.body);
    // withHttpCache short-circuitea el handle real en el hit — el repositorio solo se consulta en
    // la primera request, no en la segunda.
    expect(orderRepository.findByIdCalls).toBe(1);
  });
});
