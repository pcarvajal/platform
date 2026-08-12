import { InvalidArgumentError } from "@platform/core";
import { describe, expect, it } from "vitest";
import { createHttpDispatcher } from "./HttpDispatcher.js";
import type { HttpRequest } from "./HttpRequest.js";
import type { HttpResponse } from "./HttpResponse.js";

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

const okResponse: HttpResponse = { statusCode: 200, headers: new Map(), body: '{"ok":true}' };

describe("createHttpDispatcher", () => {
  it("happy path: devuelve la respuesta de handle sin cambios", async () => {
    const dispatch = createHttpDispatcher(
      async (raw: { path: string }) => buildRequest({ path: raw.path }),
      async () => okResponse,
    );

    const response = await dispatch({ path: "/orders" });
    expect(response).toBe(okResponse);
  });

  it("handle que tira un error de core se traduce vía toHttpError, nunca escapa la excepción", async () => {
    const dispatch = createHttpDispatcher(
      async () => buildRequest(),
      async () => {
        throw new InvalidArgumentError("bad payload");
      },
    );

    const response = await dispatch({});

    expect(response.statusCode).toBe(400);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(response.body)).toMatchObject({
      error: "BadRequestError",
      message: "bad payload",
    });
  });

  it("mapRequest que tira también se traduce (el boundary cubre ambas etapas)", async () => {
    const dispatch = createHttpDispatcher(
      async () => {
        throw new InvalidArgumentError("malformed event");
      },
      async () => okResponse,
    );

    const response = await dispatch({});

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toBe("malformed event");
  });

  it("un error no reconocido cae a 500 sin filtrar el mensaje original", async () => {
    const dispatch = createHttpDispatcher(
      async () => buildRequest(),
      async () => {
        throw new Error("db connection string leaked");
      },
    );

    const response = await dispatch({});

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("db connection string leaked");
  });

  describe("propagación de x-request-id", () => {
    it("header presente (case mixto) se reusa tal cual", async () => {
      let receivedRequest: HttpRequest | undefined;
      const dispatch = createHttpDispatcher(
        async () => buildRequest({ headers: { "X-Request-Id": "req-abc" } }),
        async (request) => {
          receivedRequest = request;
          return okResponse;
        },
      );

      await dispatch({});
      expect(receivedRequest?.requestId).toBe("req-abc");
    });

    it("header ausente: se genera un requestId no vacío", async () => {
      let receivedRequest: HttpRequest | undefined;
      const dispatch = createHttpDispatcher(
        async () => buildRequest(),
        async (request) => {
          receivedRequest = request;
          return okResponse;
        },
      );

      await dispatch({});
      expect(typeof receivedRequest?.requestId).toBe("string");
      expect(receivedRequest?.requestId).not.toHaveLength(0);
    });

    it("si el mapper ya seteó requestId, no se pisa ni se mira el header", async () => {
      let receivedRequest: HttpRequest | undefined;
      const dispatch = createHttpDispatcher(
        async () =>
          buildRequest({ requestId: "from-mapper", headers: { "x-request-id": "from-header" } }),
        async (request) => {
          receivedRequest = request;
          return okResponse;
        },
      );

      await dispatch({});
      expect(receivedRequest?.requestId).toBe("from-mapper");
    });
  });
});
