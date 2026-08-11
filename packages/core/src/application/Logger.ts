import type { RequestContext } from "../platform/index.js";

export type LogLevel = "error" | "info" | "warn" | "debug" | "silent";
export type LogContext = Record<string, unknown>;

const DEFAULT_SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "authorization",
  "apikey",
  "accesstoken",
  "refreshtoken",
  "creditcard",
  "cvv",
  "pin",
]);

function maskSensitiveFields(obj: unknown, keys: Set<string>): unknown {
  if (obj === null || typeof obj !== "object") return obj;

  if (obj instanceof Error) {
    return maskSensitiveFields(
      {
        ...obj,
        name: obj.name,
        message: obj.message,
        stack: obj.stack,
        ...(obj.cause !== undefined && { cause: obj.cause }),
      },
      keys,
    );
  }

  if (Array.isArray(obj)) return obj.map((item) => maskSensitiveFields(item, keys));

  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([key, value]) => [
      key,
      keys.has(key.toLowerCase()) ? "****" : maskSensitiveFields(value, keys),
    ]),
  );
}

export abstract class Logger {
  private readonly sensitiveKeys: Set<string>;

  constructor(extraSensitiveKeys: string[] = []) {
    this.sensitiveKeys = new Set([
      ...DEFAULT_SENSITIVE_KEYS,
      ...extraSensitiveKeys.map((k) => k.toLowerCase()),
    ]);
  }

  protected mask(context?: LogContext): LogContext | undefined {
    return context ? (maskSensitiveFields(context, this.sensitiveKeys) as LogContext) : undefined;
  }

  abstract info(message: string, context?: LogContext): void;
  abstract error(message: string, context?: LogContext): void;
  abstract warn(message: string, context?: LogContext): void;
  abstract debug(message: string, context?: LogContext): void;

  // Logger "atado" a un RequestContext: cada llamada de info/error/warn/debug lleva requestId
  // (y traceId, si hay) mezclado en el context, sin que cada call site tenga que pasarlo a mano.
  // Concreto (no abstract) porque delega en los métodos ya implementados por la subclase — ningún
  // Logger existente (NodeConsoleLoggerClient, AWSLoggerClient, FakeLogger) necesita cambiar para
  // soportarlo.
  bind(context: RequestContext): Logger {
    return new BoundLogger(this, context);
  }
}

class BoundLogger extends Logger {
  constructor(
    private readonly delegate: Logger,
    private readonly requestContext: RequestContext,
  ) {
    super();
  }

  override info(message: string, context?: LogContext): void {
    this.delegate.info(message, this.withRequestContext(context));
  }

  override error(message: string, context?: LogContext): void {
    this.delegate.error(message, this.withRequestContext(context));
  }

  override warn(message: string, context?: LogContext): void {
    this.delegate.warn(message, this.withRequestContext(context));
  }

  override debug(message: string, context?: LogContext): void {
    this.delegate.debug(message, this.withRequestContext(context));
  }

  private withRequestContext(context?: LogContext): LogContext {
    return {
      requestId: this.requestContext.requestId,
      ...(this.requestContext.traceId !== undefined && { traceId: this.requestContext.traceId }),
      ...context,
    };
  }
}
