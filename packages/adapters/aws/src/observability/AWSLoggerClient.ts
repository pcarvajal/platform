import { Logger as AWSLogger } from "@aws-lambda-powertools/logger";
import type { LogLevel } from "@aws-lambda-powertools/logger/types";
import type { AppContext, LogContext } from "@platform/core";
import { Logger } from "@platform/core";

type AWSLoggerConfig = {
  serviceName: string;
  logLevel?: LogLevel;
  sensitiveKeys?: string[];
};

export class AWSLoggerClient extends Logger {
  private readonly logger: AWSLogger;

  // No se le pasa `logLevel` a `super()`: acá el filtrado por nivel lo hace powertools, que además
  // respeta su propio override por POWERTOOLS_LOG_LEVEL — descartar mensajes antes con `shouldLog`
  // (Logger, @platform/core) anularía ese escape hatch.
  constructor(private readonly config: AWSLoggerConfig) {
    super(config.sensitiveKeys);
    this.logger = new AWSLogger({
      serviceName: this.config.serviceName,
      logLevel: this.config.logLevel,
    });
  }

  /**
   * Construye el logger a partir del contexto de aplicación de `infrastructure/env.ts`
   * (`env.appContext`, `@platform/env`) — `APP_SERVICE_NAME` como `serviceName` y `APP_LOG_LEVEL`
   * como nivel, en vez de repetir ese cableado en cada handler de cada deployment.
   *
   * El `LogLevel` de `@platform/core` (`"debug" | "info" | "warn" | "error" | "silent"`) es un
   * subconjunto del de powertools, que acepta también las variantes en minúscula — pasa tal cual,
   * sin tabla de mapeo.
   */
  static fromAppContext(
    context: AppContext,
    options: { sensitiveKeys?: string[] } = {},
  ): AWSLoggerClient {
    return new AWSLoggerClient({
      serviceName: context.APP_SERVICE_NAME,
      logLevel: context.APP_LOG_LEVEL,
      sensitiveKeys: options.sensitiveKeys,
    });
  }

  override info(message: string, context?: LogContext): void {
    this.logger.info(message, { extra: this.mask(context) });
  }

  override error(message: string, context?: LogContext): void {
    this.logger.error(message, { extra: this.mask(context) });
  }

  override warn(message: string, context?: LogContext): void {
    this.logger.warn(message, { extra: this.mask(context) });
  }

  override debug(message: string, context?: LogContext): void {
    this.logger.debug(message, { extra: this.mask(context) });
  }
}
