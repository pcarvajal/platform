import { describe, expect, it } from "vitest";
import { ApplicationError } from "../application/ApplicationError.js";
import { NotFoundError } from "../application/NotFoundError.js";
import { UnexpectedError } from "../application/UnexpectedError.js";
import { UpstreamServiceError } from "../application/UpstreamServiceError.js";
import { InvalidArgumentError } from "../domain/InvalidArgumentError.js";

// Ancla el shape de toScalars() — ver CONTRIBUTING.md § "Qué es breaking en la jerarquía de
// errores". Un test que falla acá señala un cambio de contrato de datos entre servicios, no solo
// de tipos — tsc no lo hubiera detectado.
describe("StructuredError#toScalars() contract", () => {
  it("UnexpectedError: type/origin fijos, data vacío sin cause", () => {
    expect(new UnexpectedError().toScalars()).toEqual({
      type: "UnexpectedError",
      origin: "@platform/core",
      description: "Unexpected error",
      data: {},
    });
  });

  it("cause se serializa como {name, message, stack}, no se pierde silenciosamente", () => {
    const cause = new Error("ECONNREFUSED");
    const scalars = new UnexpectedError("Wrapped", cause).toScalars();
    expect(scalars.data.cause).toMatchObject({ name: "Error", message: "ECONNREFUSED" });
    expect(typeof (scalars.data.cause as { stack?: string }).stack).toBe("string");
  });

  it("cause anidado (otro StructuredError) se serializa recursivamente vía su propio toScalars()", () => {
    const inner = new NotFoundError("Order not found");
    const outer = new UnexpectedError("Failed", inner);
    expect(outer.toScalars().data.cause).toEqual(inner.toScalars());
  });

  it("NotFoundError: origin propio de @platform/core, sin código HTTP en el type", () => {
    expect(new NotFoundError("Order not found").toScalars()).toEqual({
      type: "NotFoundError",
      origin: "@platform/core",
      description: "Order not found",
      data: {},
    });
  });

  it("UpstreamServiceError: details estructurados en data, no interpolados en message", () => {
    const scalars = new UpstreamServiceError("Upstream error", {
      statusCode: 503,
      body: "unavailable",
    }).toScalars();
    expect(scalars.data.details).toEqual({ statusCode: 503, body: "unavailable" });
    expect(scalars.description).toBe("Upstream error");
  });

  it("InvalidArgumentError (DomainError): mismo shape { type, origin, description, data }", () => {
    expect(new InvalidArgumentError("bad").toScalars()).toEqual({
      type: "InvalidArgumentError",
      origin: "@platform/core",
      description: "bad",
      data: {},
    });
  });

  it("una propiedad readonly propia del constructor de un error de proyecto aparece en data por nombre", () => {
    class OrderAlreadyShippedError extends ApplicationError {
      readonly type = "OrderAlreadyShippedError";
      constructor(readonly orderId: string) {
        super(`Order ${orderId} was already shipped`);
      }
    }

    const scalars = new OrderAlreadyShippedError("order-1").toScalars();
    expect(scalars.data).toEqual({ orderId: "order-1" });
    expect(scalars.origin).toBeUndefined();
  });
});
