import { InvalidArgumentError } from "@platform/core";
import { buildHttpRequest, FakeLogger, InMemoryRepository } from "@platform/testing";
import { describe, expect, it } from "vitest";
import { ListOrders } from "../core/application/ListOrders.js";
import type { OrderRepository } from "../core/application/OrderRepository.js";
import { Order, type OrderId } from "../core/domain/Order.js";
import { ExportOrdersController } from "./ExportOrdersController.js";

// Mismo double que createOrderRoute.test.ts: apps/ no puede importar infrastructure/ ni siquiera
// en un test co-ubicado (ver SKILL.md § Dirección de dependencias).
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

async function buildController() {
  const orderRepository = new TestOrderRepository();
  await orderRepository.save(Order.create("customer-1", ["SKU-1", "SKU-2"]));
  const paid = Order.create("customer-2", ["SKU-3"]);
  paid.markAsPaid();
  await orderRepository.save(paid);

  return new ExportOrdersController(new ListOrders(orderRepository, new FakeLogger()));
}

const request = (queryParams: Record<string, string> = {}) =>
  buildHttpRequest({ method: "GET", path: "/reports/orders.csv", queryParams });

describe("ExportOrdersController", () => {
  it("responds with a CSV attachment instead of the JSON envelope", async () => {
    const controller = await buildController();

    const response = await controller.handle(request());

    expect(response.statusCode).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="orders.csv"');
    expect(response.headers.get("X-Total-Count")).toBe("2");

    const [header, ...rows] = response.body.split("\n");
    expect(header).toBe("id,customerId,items,status");
    expect(rows).toHaveLength(2);
    // Los items de una orden van en una sola celda separados por espacio, no por coma — si no, la
    // fila tendría más columnas que el header.
    expect(rows[0]).toContain("customer-1,SKU-1 SKU-2,created");
  });

  it("filters by status using the domain value object", async () => {
    const controller = await buildController();

    const response = await controller.handle(request({ status: "paid" }));

    const rows = response.body.split("\n").slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("customer-2,SKU-3,paid");
  });

  it("rejects an unknown status before the use case runs", async () => {
    const controller = await buildController();

    // OrderStatusVO lanza sincrónicamente; en runtime lo traduce a 400 createHttpDispatcher (ver
    // deployment/aws/exportOrdersHandler.ts), que este test unitario no monta.
    await expect(controller.handle(request({ status: "delivered" }))).rejects.toThrow(
      InvalidArgumentError,
    );
  });
});
