import type { LogContext } from "@platform/core";
import { Logger } from "@platform/core";

export type LoggedCall = { message: string; context?: LogContext };

/**
 * Logger double that records calls instead of printing them, so a test can assert on what was
 * logged (`fakeLogger.calls.error`) without coupling to `console.*` or a real logging backend.
 * Masking still applies (inherited from `Logger`), so recorded calls reflect what would actually
 * reach a real sink.
 */
export class FakeLogger extends Logger {
  readonly calls: Record<"info" | "error" | "warn" | "debug", LoggedCall[]> = {
    info: [],
    error: [],
    warn: [],
    debug: [],
  };

  override info(message: string, context?: LogContext): void {
    this.calls.info.push({ message, context: this.mask(context) });
  }

  override error(message: string, context?: LogContext): void {
    this.calls.error.push({ message, context: this.mask(context) });
  }

  override warn(message: string, context?: LogContext): void {
    this.calls.warn.push({ message, context: this.mask(context) });
  }

  override debug(message: string, context?: LogContext): void {
    this.calls.debug.push({ message, context: this.mask(context) });
  }
}
