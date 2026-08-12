import { describe, expect, it } from "vitest";
import { NotFoundError } from "./HttpError.js";
import { HttpRouter } from "./HttpRouter.js";
import type { HttpRequest } from "./HttpRequest.js";
import type { HttpResponse } from "./HttpResponse.js";
import type { HttpRoute } from "./HttpRoute.js";

function buildRequest(overrides: Partial<HttpRequest> = {}): HttpRequest {
  return {
    method: "GET",
    path: "/",
    pathParams: {},
    queryParams: {},
    headers: {},
    rawBody: null,
    ...overrides,
  };
}

const ok: HttpResponse = { statusCode: 200, headers: new Map(), body: "{}" };

function route(method: HttpRoute["method"], path: string, handle: HttpRoute["handle"]): HttpRoute {
  return { method, path, handle };
}

describe("HttpRouter#dispatch", () => {
  it("match exacto de path estático invoca el handle de la route correcta", async () => {
    let called = false;
    const router = new HttpRouter([
      route("GET", "/orders", async () => {
        called = true;
        return ok;
      }),
    ]);

    const response = await router.dispatch(buildRequest({ method: "GET", path: "/orders" }));

    expect(called).toBe(true);
    expect(response).toBe(ok);
  });

  it("extrae un único :param y lo mezcla en pathParams", async () => {
    let receivedParams: HttpRequest["pathParams"] | undefined;
    const router = new HttpRouter([
      route("GET", "/orders/:id", async (request) => {
        receivedParams = request.pathParams;
        return ok;
      }),
    ]);

    await router.dispatch(buildRequest({ method: "GET", path: "/orders/order-1" }));

    expect(receivedParams).toEqual({ id: "order-1" });
  });

  it("extrae varios :param en el mismo path", async () => {
    let receivedParams: HttpRequest["pathParams"] | undefined;
    const router = new HttpRouter([
      route("GET", "/orders/:orderId/items/:itemId", async (request) => {
        receivedParams = request.pathParams;
        return ok;
      }),
    ]);

    await router.dispatch(buildRequest({ method: "GET", path: "/orders/order-1/items/item-9" }));

    expect(receivedParams).toEqual({ orderId: "order-1", itemId: "item-9" });
  });

  it("sin match de method+path tira NotFoundError nombrando method y path", () => {
    // dispatch no es `async` — el throw por "sin match" es síncrono (antes de devolver la
    // Promise de route.handle), a diferencia del resto de esta suite que sí await-ea una Promise.
    const router = new HttpRouter([route("GET", "/orders", async () => ok)]);

    expect(() => router.dispatch(buildRequest({ method: "POST", path: "/orders" }))).toThrow(
      NotFoundError,
    );
    expect(() => router.dispatch(buildRequest({ method: "GET", path: "/missing" }))).toThrow(
      /No route for GET \/missing/,
    );
  });

  it("un mismatch de method salta esa route aunque el path coincida", async () => {
    let getCalled = false;
    let postCalled = false;
    const router = new HttpRouter([
      route("GET", "/orders", async () => {
        getCalled = true;
        return ok;
      }),
      route("POST", "/orders", async () => {
        postCalled = true;
        return ok;
      }),
    ]);

    await router.dispatch(buildRequest({ method: "POST", path: "/orders" }));

    expect(postCalled).toBe(true);
    expect(getCalled).toBe(false);
  });

  it("la primera route que matchea gana", async () => {
    let firstCalled = false;
    let secondCalled = false;
    const router = new HttpRouter([
      route("GET", "/orders/:id", async () => {
        firstCalled = true;
        return ok;
      }),
      route("GET", "/orders/:id", async () => {
        secondCalled = true;
        return ok;
      }),
    ]);

    await router.dispatch(buildRequest({ method: "GET", path: "/orders/order-1" }));

    expect(firstCalled).toBe(true);
    expect(secondCalled).toBe(false);
  });

  it("un segmento extra o faltante no matchea (sin match parcial)", () => {
    const router = new HttpRouter([route("GET", "/orders/:id", async () => ok)]);

    expect(() =>
      router.dispatch(buildRequest({ method: "GET", path: "/orders/order-1/extra" })),
    ).toThrow(NotFoundError);
    expect(() => router.dispatch(buildRequest({ method: "GET", path: "/orders" }))).toThrow(
      NotFoundError,
    );
  });
});

describe("HttpRouter#describe", () => {
  it("devuelve 'METHOD path' de todas las routes registradas", () => {
    const router = new HttpRouter([
      route("GET", "/orders", async () => ok),
      route("POST", "/orders", async () => ok),
      route("GET", "/orders/:id", async () => ok),
    ]);

    expect(router.describe()).toEqual(["GET /orders", "POST /orders", "GET /orders/:id"]);
  });
});
