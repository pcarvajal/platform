import type { AppContext } from "@platform/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NodeConsoleLoggerClient } from "./NodeConsoleLoggerClient.js";

const appContext = (overrides: Partial<AppContext> = {}): AppContext => ({
  APP_SERVICE_NAME: "reference-service",
  APP_ENVIRONMENT: "development",
  APP_LOG_LEVEL: "debug",
  ...overrides,
});

const spyOnConsole = () => ({
  debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
  info: vi.spyOn(console, "info").mockImplementation(() => {}),
  warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
  error: vi.spyOn(console, "error").mockImplementation(() => {}),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("NodeConsoleLoggerClient", () => {
  it("sin nivel imprime los cuatro niveles — comportamiento previo a APP_LOG_LEVEL", () => {
    const console_ = spyOnConsole();
    const logger = new NodeConsoleLoggerClient();

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(console_.debug).toHaveBeenCalledOnce();
    expect(console_.info).toHaveBeenCalledOnce();
    expect(console_.warn).toHaveBeenCalledOnce();
    expect(console_.error).toHaveBeenCalledOnce();
  });

  it("descarta lo que está por debajo del nivel recibido por constructor", () => {
    const console_ = spyOnConsole();
    const logger = new NodeConsoleLoggerClient(undefined, "warn");

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(console_.debug).not.toHaveBeenCalled();
    expect(console_.info).not.toHaveBeenCalled();
    expect(console_.warn).toHaveBeenCalledOnce();
    expect(console_.error).toHaveBeenCalledOnce();
  });

  it("fromAppContext aplica APP_LOG_LEVEL del contexto de aplicación", () => {
    const console_ = spyOnConsole();
    const logger = NodeConsoleLoggerClient.fromAppContext(appContext({ APP_LOG_LEVEL: "error" }));

    logger.warn("w");
    logger.error("e");

    expect(console_.warn).not.toHaveBeenCalled();
    expect(console_.error).toHaveBeenCalledWith("[ERROR] e", undefined);
  });

  it('fromAppContext con APP_LOG_LEVEL "silent" no emite nada', () => {
    const console_ = spyOnConsole();
    const logger = NodeConsoleLoggerClient.fromAppContext(appContext({ APP_LOG_LEVEL: "silent" }));

    logger.debug("d");
    logger.error("e");

    expect(console_.debug).not.toHaveBeenCalled();
    expect(console_.error).not.toHaveBeenCalled();
  });

  it("sigue enmascarando campos sensibles, incluidos los extra de fromAppContext", () => {
    const console_ = spyOnConsole();
    const logger = NodeConsoleLoggerClient.fromAppContext(appContext(), {
      sensitiveKeys: ["rut"],
    });

    logger.info("hola", { password: "hunter2", rut: "1-9", user: "ana" });

    expect(console_.info).toHaveBeenCalledWith("[INFO] hola", {
      password: "****",
      rut: "****",
      user: "ana",
    });
  });
});
