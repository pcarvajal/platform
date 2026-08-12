import { describe, expect, it } from "vitest";
import { ok } from "./ApiResponse.js";

describe("ok", () => {
  it("sin meta: solo { data }, sin key meta", () => {
    expect(ok({ id: "order-1" })).toEqual({ data: { id: "order-1" } });
  });

  it("con meta: { data, meta }", () => {
    expect(ok({ id: "order-1" }, { total: 1 })).toEqual({
      data: { id: "order-1" },
      meta: { total: 1 },
    });
  });
});
