import { describe, expect, it } from "vitest";
import { ExtensibleError } from "../platform/index.js";
import { ApplicationError } from "./ApplicationError.js";
import { NotFoundError } from "./NotFoundError.js";
import {
  matchApplicationResult,
  toApplicationFailure,
  toApplicationSuccess,
} from "./ApplicationResult.js";

describe("toApplicationSuccess", () => {
  it("envuelve el dato en { ok: true, data }", () => {
    expect(toApplicationSuccess({ id: "order-1" })).toEqual({
      ok: true,
      data: { id: "order-1" },
    });
  });
});

describe("toApplicationFailure", () => {
  it("un ExtensibleError conserva su propio type/origin/message vía toScalars()", () => {
    const result = toApplicationFailure(new NotFoundError("Order not found"));
    expect(result.ok).toBe(false);
    expect(result.error.type).toBe("NotFoundError");
    expect(result.error.origin).toBe("@platform/core");
    expect(result.error.message).toBe("Order not found");
  });

  it("un Error plano (no ExtensibleError) se envuelve en UnexpectedError sin filtrar el mensaje original al type", () => {
    const result = toApplicationFailure(new Error("db connection string leaked"));
    expect(result.ok).toBe(false);
    expect(result.error.type).toBe("UnexpectedError");
    expect(result.error.type).not.toContain("db connection string leaked");
  });

  it("cualquier otro valor tirado (no Error) también cae en UnexpectedError", () => {
    const result = toApplicationFailure("just a string");
    expect(result.error.type).toBe("UnexpectedError");
    expect(result.error.origin).toBe("@platform/core");
  });

  it("origin se omite del resultado cuando el error no lo define", () => {
    // Mismo patrón que el ejemplo de toScalars.contract.test.ts: extiende ApplicationError
    // directo (no uno de los default errors, que sí fijan `origin`) para que quede undefined —
    // es lo esperable para un error de proyecto real, que nunca declara `origin`.
    class ProjectError extends ApplicationError {
      readonly type = "ProjectError";
      constructor() {
        super("project error");
      }
    }

    const result = toApplicationFailure(new ProjectError());
    expect(result.error).not.toHaveProperty("origin");
  });

  it("data se omite del resultado cuando toScalars().data está genuinamente vacío", () => {
    // A diferencia de ApplicationError/DomainError (que siempre declaran `details`, aunque sea
    // undefined, así que `data` casi nunca queda vacío para ellos — ver el siguiente test), un
    // ExtensibleError sin propiedades propias extra sí produce data: {} real.
    class BareError extends ExtensibleError {
      readonly type = "BareError";
      constructor() {
        super("bare");
      }
    }

    const result = toApplicationFailure(new BareError());
    expect(result.error).not.toHaveProperty("data");
  });

  it("data incluye `details: undefined` para cualquier ApplicationError/DomainError sin details explícito", () => {
    // ApplicationError/DomainError declaran `readonly details?: unknown` y lo asignan siempre en
    // el constructor (incluso a undefined) — por eso queda como propiedad propia enumerable y
    // Object.keys(data).length nunca es 0 para estos errores, aunque no se pase `details`.
    const result = toApplicationFailure(new NotFoundError("Order not found"));
    expect(result.error.data).toEqual({});
    expect(result.error).toHaveProperty("data", { details: undefined });
  });

  it("data incluye las propiedades propias del error de proyecto (ej. orderId)", () => {
    // Extiende ApplicationError directo, no un default error concreto — NotFoundError/etc. fijan
    // `type` a un literal propio (p. ej. "NotFoundError"), así que una subclase no puede
    // redeclararlo a otro literal distinto (error de tipos, no solo de convención).
    class OrderAlreadyShippedError extends ApplicationError {
      readonly type = "OrderAlreadyShippedError";
      constructor(readonly orderId: string) {
        super(`Order ${orderId} was already shipped`);
      }
    }

    const result = toApplicationFailure(new OrderAlreadyShippedError("order-1"));
    expect(result.error.data).toEqual({ orderId: "order-1" });
  });
});

describe("matchApplicationResult", () => {
  it("invoca onSuccess y devuelve su resultado cuando ok es true", () => {
    const value = matchApplicationResult(toApplicationSuccess(42), {
      onSuccess: (data) => data * 2,
      onError: () => -1,
    });
    expect(value).toBe(84);
  });

  it("invoca onError y devuelve su resultado cuando ok es false", () => {
    const value = matchApplicationResult(toApplicationFailure(new NotFoundError("missing")), {
      onSuccess: () => "unreachable",
      onError: (error) => error.type,
    });
    expect(value).toBe("NotFoundError");
  });
});
