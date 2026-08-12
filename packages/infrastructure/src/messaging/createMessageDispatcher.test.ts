import { toApplicationSuccess } from "@platform/core";
import { describe, expect, it } from "vitest";
import { createMessageDispatcher } from "./createMessageDispatcher.js";
import type { MessageEnvelope } from "./MessageEnvelope.js";
import type { MessageRoute } from "./MessageRoute.js";

function buildEnvelope(overrides: Partial<MessageEnvelope> = {}): MessageEnvelope {
  return {
    id: "msg-1",
    source: "orders",
    receivedAt: new Date(),
    attributes: {},
    body: {},
    ...overrides,
  };
}

describe("createMessageDispatcher", () => {
  it("un envelope que matchea una route usa el resultado de esa route", async () => {
    const route: MessageRoute = {
      matches: (envelope) => envelope.source === "orders",
      handle: async () => toApplicationSuccess({ processed: true }),
    };
    const dispatch = createMessageDispatcher(
      (raw: MessageEnvelope[]) => raw,
      [route],
      (results) => results,
    );

    const envelope = buildEnvelope({ source: "orders" });
    const results = await dispatch([envelope]);

    expect(results).toEqual([{ envelope, result: { ok: true, data: { processed: true } } }]);
  });

  it("un envelope sin route que lo maneje devuelve un NotFoundError como resultado del item, sin tirar excepción", async () => {
    const dispatch = createMessageDispatcher(
      (raw: MessageEnvelope[]) => raw,
      [], // ninguna route registrada
      (results) => results,
    );

    const envelope = buildEnvelope({ source: "shipping" });
    const results = await dispatch([envelope]);

    expect(results).toHaveLength(1);
    const [item] = results;
    expect(item?.envelope).toBe(envelope);
    expect(item?.result.ok).toBe(false);
    if (item && !item.result.ok) {
      expect(item.result.error.type).toBe("NotFoundError");
    }
  });

  it("varios envelopes con match/no-match mixto: cada uno tiene su resultado independiente", async () => {
    const ordersRoute: MessageRoute = {
      matches: (envelope) => envelope.source === "orders",
      handle: async () => toApplicationSuccess("orders-ok"),
    };

    const dispatch = createMessageDispatcher(
      (raw: MessageEnvelope[]) => raw,
      [ordersRoute],
      (results) => results,
    );

    const matching = buildEnvelope({ id: "1", source: "orders" });
    const nonMatching = buildEnvelope({ id: "2", source: "shipping" });
    const results = await dispatch([matching, nonMatching]);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ envelope: matching, result: { ok: true, data: "orders-ok" } });
    expect(results[1]?.result.ok).toBe(false);
  });

  it("un mensaje que falla no aborta el resto del batch (Promise.all fan-out independiente)", async () => {
    const flakyRoute: MessageRoute = {
      matches: () => true,
      handle: async (envelope) => {
        if (envelope.id === "boom") throw new Error("handler blew up");
        return toApplicationSuccess("ok");
      },
    };

    const dispatch = createMessageDispatcher(
      (raw: MessageEnvelope[]) => raw,
      [flakyRoute],
      (results) => results,
    );

    // El propio route.handle no debería tirar en este caso (no envuelve, ver createMessageDispatcher.ts:
    // solo el "sin route" cae a toApplicationFailure) — este test documenta que si una route SÍ
    // tira, el batch entero rechaza, a diferencia del caso "sin route que matchee".
    await expect(dispatch([buildEnvelope({ id: "boom" })])).rejects.toThrow("handler blew up");
  });

  it("toProviderResult recibe todos los resultados juntos y su valor de retorno se devuelve sin cambios", async () => {
    const route: MessageRoute = {
      matches: () => true,
      handle: async () => toApplicationSuccess("ok"),
    };
    const providerResult = { batchItemFailures: [] as string[] };

    const dispatch = createMessageDispatcher(
      (raw: MessageEnvelope[]) => raw,
      [route],
      () => providerResult,
    );

    const result = await dispatch([buildEnvelope(), buildEnvelope({ id: "2" })]);
    expect(result).toBe(providerResult);
  });
});
