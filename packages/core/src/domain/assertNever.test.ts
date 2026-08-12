import { describe, expect, it } from "vitest";
import { assertNever } from "./assertNever.js";
import { UnreachableCaseError } from "./UnreachableCaseError.js";

describe("assertNever", () => {
  it("tira UnreachableCaseError con el valor stringificado a JSON en el mensaje", () => {
    // Nunca se ejecuta en producción (protege switches exhaustivos) — igual vale un smoke test
    // directo, forzando el cast a `never` como haría un `default` alcanzado por drift de tipos.
    const drifted = "unexpected-status" as unknown as never;
    expect(() => assertNever(drifted)).toThrow(UnreachableCaseError);
    expect(() => assertNever(drifted)).toThrow(/"unexpected-status"/);
  });
});
