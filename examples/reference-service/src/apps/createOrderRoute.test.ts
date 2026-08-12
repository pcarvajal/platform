import { UnprocessableEntityError } from "@platform/infrastructure";
import {
  buildHttpRequest,
  FakeLogger,
  InMemoryEventBus,
  InMemoryRepository,
} from "@platform/testing";
import { describe, expect, it } from "vitest";
import { CreateOrder } from "../core/application/CreateOrder.js";
import type { OrderRepository } from "../core/application/OrderRepository.js";
import type { Order, OrderId } from "../core/domain/Order.js";
import { createOrderRoute } from "./createOrderRoute.js";

// apps/ no puede importar infrastructure/ (ver SKILL.md § Dirección de dependencias) — ni siquiera
// en un test co-ubicado, así que este double se apoya en InMemoryRepository (@platform/testing, un
// paquete externo) en vez de `../infrastructure/persistence/InMemoryOrderRepository.js` real. Se
// compone en vez de extenderse directo porque su TId es un string plano y OrderRepository pide
// OrderId (ver references/testing.md).
class TestOrderRepository implements OrderRepository {
  private readonly repository = new (class extends InMemoryRepository<string, Order> {})();

  save(order: Order): Promise<void> {
    return this.repository.save(order);
  }
  findById(id: OrderId): Promise<Order | undefined> {
    return this.repository.findById(id.value);
  }
  findAll(): Promise<Order[]> {
    return this.repository.findAll();
  }
}

function buildRoute() {
  const orderRepository = new TestOrderRepository();
  const createOrder = new CreateOrder(orderRepository, new InMemoryEventBus(), new FakeLogger());
  return { route: createOrderRoute(createOrder), orderRepository };
}

describe("createOrderRoute", () => {
  it("returns 201 with the created order on a valid body", async () => {
    const { route } = buildRoute();
    // buildHttpRequest (@platform/testing) rellena method/path/headers/query con defaults, así
    // que el test solo declara lo que le importa: el body.
    const request = buildHttpRequest({
      method: "POST",
      path: "/orders",
      rawBody: JSON.stringify({ customerId: "customer-1", items: ["SKU-1"] }),
    });

    const response = await route.handle(request);

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body) as { data: { status: string } };
    expect(body.data.status).toBe("created");
  });

  it("rejects a body missing required fields before the use case ever runs", async () => {
    const { route } = buildRoute();
    const request = buildHttpRequest({
      method: "POST",
      path: "/orders",
      rawBody: JSON.stringify({ customerId: "customer-1" }),
    });

    // parseJsonBody tira UnprocessableEntityError sincrónicamente (ver references/http.md) — sin
    // createHttpDispatcher envolviendo la llamada (como en un test unitario de la ruta, no del
    // servidor completo), eso significa que el handle() rechaza en vez de devolver un 422.
    await expect(route.handle(request)).rejects.toThrow(UnprocessableEntityError);
  });
});
