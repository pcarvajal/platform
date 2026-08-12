import { describe, expect, it } from "vitest";
import type { RequestContext } from "../platform/index.js";
import { BaseUseCase } from "./BaseUseCase.js";
import type { LogContext } from "./Logger.js";
import { Logger } from "./Logger.js";

class FakeLogger extends Logger {
  readonly calls: { level: string; message: string; context?: LogContext }[] = [];
  info(message: string, context?: LogContext): void {
    this.calls.push({ level: "info", message, context });
  }
  error(message: string, context?: LogContext): void {
    this.calls.push({ level: "error", message, context });
  }
  warn(message: string, context?: LogContext): void {
    this.calls.push({ level: "warn", message, context });
  }
  debug(message: string, context?: LogContext): void {
    this.calls.push({ level: "debug", message, context });
  }
}

class EchoUseCase extends BaseUseCase<string, string> {
  protected async handle(command: string): Promise<string> {
    if (command === "boom") throw new Error("boom");
    return `echo:${command}`;
  }
}

describe("BaseUseCase#execute", () => {
  it("handle() exitoso → devuelve toApplicationSuccess(data)", async () => {
    const useCase = new EchoUseCase();
    const result = await useCase.execute("hi");
    expect(result).toEqual({ ok: true, data: "echo:hi" });
  });

  it("handle() que tira → devuelve toApplicationFailure(err) y loguea el fallo una vez", async () => {
    const logger = new FakeLogger();
    const useCase = new EchoUseCase(logger);

    const result = await useCase.execute("boom");

    expect(result.ok).toBe(false);
    expect(logger.calls).toHaveLength(1);
    expect(logger.calls[0]?.level).toBe("error");
    expect(logger.calls[0]?.message).toBe("EchoUseCase failed");
    expect(logger.calls[0]?.context?.err).toBeInstanceOf(Error);
  });

  it("con context, el log de error pasa por logger.bind(context) (requestId presente)", async () => {
    const logger = new FakeLogger();
    const useCase = new EchoUseCase(logger);
    const context: RequestContext = { requestId: "req-1", timestamp: new Date() };

    await useCase.execute("boom", context);

    expect(logger.calls).toHaveLength(1);
    expect(logger.calls[0]?.context).toMatchObject({ requestId: "req-1" });
  });

  it("sin logger, el path de error no explota (logger?.error es opcional)", async () => {
    const useCase = new EchoUseCase();
    const result = await useCase.execute("boom");
    expect(result.ok).toBe(false);
  });
});
