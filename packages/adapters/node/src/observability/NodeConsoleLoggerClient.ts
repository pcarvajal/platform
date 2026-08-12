import type { AppContext, LogContext, LogLevel } from "@platform/core";
import { Logger } from "@platform/core";

export class NodeConsoleLoggerClient extends Logger {
  constructor(sensitiveKeys?: string[], level?: LogLevel) {
    super(sensitiveKeys, level);
  }

  /**
   * Construye el logger a partir del contexto de aplicación de `infrastructure/env.ts`
   * (`env.appContext`, `@platform/env`), que es el único lugar del proyecto que conoce
   * `APP_LOG_LEVEL`. Sin esto, el nivel queda validado al arrancar pero no lo aplica nadie.
   *
   * Solo usa `APP_LOG_LEVEL` del contexto: `console.*` no tiene dónde poner el nombre del servicio
   * sin cambiar el formato de línea ya establecido (`[INFO] mensaje`), a diferencia de
   * `AWSLoggerClient`, que sí lo emite como campo estructurado.
   */
  static fromAppContext(
    context: AppContext,
    options: { sensitiveKeys?: string[] } = {},
  ): NodeConsoleLoggerClient {
    return new NodeConsoleLoggerClient(options.sensitiveKeys, context.APP_LOG_LEVEL);
  }

  // `console` no tiene noción de nivel, así que el filtrado lo aplica esta clase vía `shouldLog`
  // (en `AWSLoggerClient` lo hace powertools, que además respeta su propio POWERTOOLS_LOG_LEVEL).
  // Sin nivel configurado, `shouldLog` devuelve siempre true: imprime todo, como antes.
  override info(message: string, context?: LogContext): void {
    if (!this.shouldLog("info")) return;
    console.info(`[INFO] ${message}`, this.mask(context));
  }
  override error(message: string, context?: LogContext): void {
    if (!this.shouldLog("error")) return;
    console.error(`[ERROR] ${message}`, this.mask(context));
  }
  override warn(message: string, context?: LogContext): void {
    if (!this.shouldLog("warn")) return;
    console.warn(`[WARN] ${message}`, this.mask(context));
  }
  override debug(message: string, context?: LogContext): void {
    if (!this.shouldLog("debug")) return;
    console.debug(`[DEBUG] ${message}`, this.mask(context));
  }
}
