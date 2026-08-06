import type { LogContext } from "@platform/core";
import { Logger } from "@platform/core";

export class NodeConsoleLoggerClient extends Logger {
  constructor(sensitiveKeys?: string[]) {
    super(sensitiveKeys);
  }

  override info(message: string, context?: LogContext): void {
    console.info(`[INFO] ${message}`, this.mask(context));
  }
  override error(message: string, context?: LogContext): void {
    console.error(`[ERROR] ${message}`, this.mask(context));
  }
  override warn(message: string, context?: LogContext): void {
    console.warn(`[WARN] ${message}`, this.mask(context));
  }
  override debug(message: string, context?: LogContext): void {
    console.debug(`[DEBUG] ${message}`, this.mask(context));
  }
}
