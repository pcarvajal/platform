import { describe, expect, it } from "vitest";
import type { RequestContext } from "../platform/index.js";
import type { LogContext } from "./Logger.js";
import { Logger } from "./Logger.js";

// `mask()` es protected — Logger nunca la llama internamente, cada subclase concreta decide
// invocarla dentro de su propio info/error/warn/debug (ver NodeConsoleLoggerClient en
// @platform/adapter-node). `exposeMask` la expone solo para poder testearla acá.
class TestLogger extends Logger {
  readonly calls: { level: string; message: string; context?: LogContext }[] = [];

  // Consulta `shouldLog` en cada método, igual que hace una subclase real que filtra por nivel
  // (NodeConsoleLoggerClient) — sin nivel en el constructor no descarta nada.
  info(message: string, context?: LogContext): void {
    if (!this.shouldLog("info")) return;
    this.calls.push({ level: "info", message, context });
  }
  error(message: string, context?: LogContext): void {
    if (!this.shouldLog("error")) return;
    this.calls.push({ level: "error", message, context });
  }
  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog("warn")) return;
    this.calls.push({ level: "warn", message, context });
  }
  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog("debug")) return;
    this.calls.push({ level: "debug", message, context });
  }

  exposeMask(context?: LogContext): LogContext | undefined {
    return this.mask(context);
  }
}

describe("Logger#mask", () => {
  it("redacta cada key de DEFAULT_SENSITIVE_KEYS, case-insensitive", () => {
    const logger = new TestLogger();
    const masked = logger.exposeMask({
      password: "hunter2",
      Token: "abc",
      SECRET: "xyz",
      authorization: "Bearer abc",
      apikey: "k1",
      accesstoken: "a1",
      refreshtoken: "r1",
      creditcard: "4111",
      cvv: "123",
      pin: "0000",
      username: "ana",
    });

    expect(masked).toEqual({
      password: "****",
      Token: "****",
      SECRET: "****",
      authorization: "****",
      apikey: "****",
      accesstoken: "****",
      refreshtoken: "****",
      creditcard: "****",
      cvv: "****",
      pin: "****",
      username: "ana",
    });
  });

  it("redacta en objetos anidados y arrays de objetos, en cualquier profundidad", () => {
    const logger = new TestLogger();
    const masked = logger.exposeMask({
      user: { name: "ana", password: "hunter2" },
      tags: [{ token: "abc" }, { ok: 1 }],
    });

    expect(masked).toEqual({
      user: { name: "ana", password: "****" },
      tags: [{ token: "****" }, { ok: 1 }],
    });
  });

  it("redacta campos sensibles propios de un Error, preservando name/message/stack y cause", () => {
    const logger = new TestLogger();
    const cause = new Error("root cause");
    const err = Object.assign(new Error("boom", { cause }), { password: "leaked" });

    const masked = logger.exposeMask({ err }) as { err: Record<string, unknown> };

    expect(masked.err.name).toBe("Error");
    expect(masked.err.message).toBe("boom");
    expect(typeof masked.err.stack).toBe("string");
    expect(masked.err.password).toBe("****");
    expect(masked.err.cause).toMatchObject({ name: "Error", message: "root cause" });
  });

  it("extraSensitiveKeys del constructor se redactan junto a las default", () => {
    const logger = new TestLogger(["custom"]);
    const masked = logger.exposeMask({ custom: "x", other: "y" });
    expect(masked).toEqual({ custom: "****", other: "y" });
  });

  it("mask(undefined) devuelve undefined", () => {
    const logger = new TestLogger();
    expect(logger.exposeMask(undefined)).toBeUndefined();
  });
});

describe("Logger#shouldLog", () => {
  const levelsLogged = (logger: TestLogger): string[] => {
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    return logger.calls.map(({ level }) => level);
  };

  it("sin nivel en el constructor no filtra nada — comportamiento previo a APP_LOG_LEVEL", () => {
    expect(levelsLogged(new TestLogger())).toEqual(["debug", "info", "warn", "error"]);
  });

  it('con nivel "debug" deja pasar los cuatro niveles', () => {
    expect(levelsLogged(new TestLogger([], "debug"))).toEqual(["debug", "info", "warn", "error"]);
  });

  it("descarta todo lo que esté por debajo del nivel configurado", () => {
    expect(levelsLogged(new TestLogger([], "warn"))).toEqual(["warn", "error"]);
  });

  it('con nivel "silent" no emite ningún nivel', () => {
    expect(levelsLogged(new TestLogger([], "silent"))).toEqual([]);
  });

  it("el filtrado sigue aplicando a través de bind() — el umbral lo pone el logger delegado", () => {
    const logger = new TestLogger([], "warn");
    const bound = logger.bind({ requestId: "req-1", timestamp: new Date() });

    bound.debug("descartado");
    bound.error("emitido");

    expect(logger.calls).toEqual([
      { level: "error", message: "emitido", context: { requestId: "req-1" } },
    ]);
  });
});

describe("Logger#bind", () => {
  it("el BoundLogger mezcla requestId/traceId en cada llamada, delegando en el logger original", () => {
    const logger = new TestLogger();
    const context: RequestContext = {
      requestId: "req-1",
      traceId: "trace-1",
      timestamp: new Date(),
    };
    const bound = logger.bind(context);

    bound.info("hello", { foo: "bar" });
    bound.error("failed", { err: "boom" });

    expect(logger.calls).toEqual([
      {
        level: "info",
        message: "hello",
        context: { requestId: "req-1", traceId: "trace-1", foo: "bar" },
      },
      {
        level: "error",
        message: "failed",
        context: { requestId: "req-1", traceId: "trace-1", err: "boom" },
      },
    ]);
  });

  it("sin traceId en el RequestContext, la key no aparece en el context logueado", () => {
    const logger = new TestLogger();
    const bound = logger.bind({ requestId: "req-1", timestamp: new Date() });

    bound.debug("tick");

    expect(logger.calls).toEqual([
      { level: "debug", message: "tick", context: { requestId: "req-1" } },
    ]);
  });

  it("funciona sin context propio en la llamada (solo requestId/traceId)", () => {
    const logger = new TestLogger();
    const bound = logger.bind({ requestId: "req-1", timestamp: new Date() });

    bound.warn("no context");

    expect(logger.calls).toEqual([
      { level: "warn", message: "no context", context: { requestId: "req-1" } },
    ]);
  });
});
