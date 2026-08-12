import type { StandardSchemaV1 } from "@platform/core";
import { describe, expect, it } from "vitest";
import { BadRequestError, UnprocessableEntityError } from "./HttpError.js";
import type { HttpRequest } from "./HttpRequest.js";
import { parseJsonBody, parsePathParams, parseQueryParams } from "./validateRequest.js";

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

// Schema mínimo hecho a mano (infrastructure no depende de @platform/env ni de zod) — solo
// requiere un `name` string no vacío, suficiente para ejercitar los branches de éxito/fallo.
const nameSchema: StandardSchemaV1<unknown, { name: string }> = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value: unknown) => {
      const v = value as Record<string, unknown> | null | undefined;
      if (typeof v?.name === "string" && v.name.length > 0) {
        return { value: { name: v.name } };
      }
      return { issues: [{ message: "name is required", path: ["name"] }] };
    },
  },
};

describe("parseJsonBody", () => {
  it("rawBody ausente tira BadRequestError", () => {
    expect(() => parseJsonBody(buildRequest({ rawBody: null }), nameSchema)).toThrow(
      BadRequestError,
    );
    expect(() => parseJsonBody(buildRequest({ rawBody: null }), nameSchema)).toThrow(
      /Request body is required/,
    );
  });

  it("JSON malformado tira BadRequestError con el error de JSON.parse como cause", () => {
    const request = buildRequest({ rawBody: "{not json" });
    expect(() => parseJsonBody(request, nameSchema)).toThrow(BadRequestError);
    try {
      parseJsonBody(request, nameSchema);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
      expect((err as BadRequestError).message).toBe("Request body is not valid JSON");
      expect((err as BadRequestError).cause).toBeInstanceOf(SyntaxError);
    }
  });

  it("JSON válido que no matchea el schema tira UnprocessableEntityError con los issues como details", () => {
    const request = buildRequest({ rawBody: JSON.stringify({}) });
    try {
      parseJsonBody(request, nameSchema);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(UnprocessableEntityError);
      expect((err as UnprocessableEntityError).message).toBe("Request body validation failed");
      // parseJsonBody usa result.issues de validateStandardSchema (@platform/core), que ya aplana
      // el `path` del schema (array de PropertyKey) a un string joined — no el array crudo.
      expect((err as UnprocessableEntityError).details).toEqual([
        { path: "name", message: "name is required" },
      ]);
    }
  });

  it("JSON válido que matchea el schema devuelve el valor parseado+validado", () => {
    const request = buildRequest({ rawBody: JSON.stringify({ name: "orders-service" }) });
    expect(parseJsonBody(request, nameSchema)).toEqual({ name: "orders-service" });
  });
});

describe("parseQueryParams", () => {
  it("query params válidos devuelven el valor validado", () => {
    const request = buildRequest({ queryParams: { name: "orders-service" } });
    expect(parseQueryParams(request, nameSchema)).toEqual({ name: "orders-service" });
  });

  it("query params inválidos tiran UnprocessableEntityError", () => {
    const request = buildRequest({ queryParams: {} });
    expect(() => parseQueryParams(request, nameSchema)).toThrow(UnprocessableEntityError);
    expect(() => parseQueryParams(request, nameSchema)).toThrow(/Query params validation failed/);
  });
});

describe("parsePathParams", () => {
  it("path params válidos devuelven el valor validado", () => {
    const request = buildRequest({ pathParams: { name: "orders-service" } });
    expect(parsePathParams(request, nameSchema)).toEqual({ name: "orders-service" });
  });

  it("path params inválidos tiran UnprocessableEntityError", () => {
    const request = buildRequest({ pathParams: {} });
    expect(() => parsePathParams(request, nameSchema)).toThrow(UnprocessableEntityError);
    expect(() => parsePathParams(request, nameSchema)).toThrow(/Path params validation failed/);
  });
});
