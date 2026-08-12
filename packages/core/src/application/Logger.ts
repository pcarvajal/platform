import type { RequestContext } from "../platform/index.js";

export type LogLevel = "error" | "info" | "warn" | "debug" | "silent";
// Contraparte en runtime de LogLevel — necesaria para validar contra ella (p.ej. env.enum(LOG_LEVELS)
// en @platform/env), ya que el union por sí solo no existe en tiempo de ejecución.
export const LOG_LEVELS = [
  "debug",
  "info",
  "warn",
  "error",
  "silent",
] as const satisfies readonly LogLevel[];
export type LogContext = Record<string, unknown>;

// Severidad relativa de cada nivel, para que `shouldLog` pueda responder "¿este mensaje llega al
// umbral configurado?" — el union `LogLevel` por sí solo no tiene orden. "silent" queda por encima
// de todos los niveles logueables, así que ninguno lo alcanza y no se emite nada.
const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

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
  private readonly level: LogLevel | undefined;

  // `level` es opcional y va al final: sin él, `shouldLog` no filtra nada, así que toda subclase
  // existente y todo `new NodeConsoleLoggerClient()` ya escrito se comportan exactamente igual que
  // antes — agregar un parámetro opcional al final es aditivo (ver CONTRIBUTING.md § Logger).
  constructor(extraSensitiveKeys: string[] = [], level?: LogLevel) {
    this.sensitiveKeys = new Set([
      ...DEFAULT_SENSITIVE_KEYS,
      ...extraSensitiveKeys.map((k) => k.toLowerCase()),
    ]);
    this.level = level;
  }

  protected mask(context?: LogContext): LogContext | undefined {
    return context ? (maskSensitiveFields(context, this.sensitiveKeys) as LogContext) : undefined;
  }

  // Umbral de nivel del logger — el punto donde APP_LOG_LEVEL (contexto de aplicación, ver
  // @platform/env) deja de ser un valor validado y sin uso y pasa a decidir qué se emite.
  //
  // Concreto (no abstracto) por la misma razón que `bind`: un método abstracto nuevo rompería toda
  // subclase existente de Logger (CONTRIBUTING.md § Logger). Cada subclase decide invocarlo dentro
  // de su propio info/error/warn/debug, igual que con `mask` — una que delegue el filtrado en su
  // librería subyacente (AWSLoggerClient → powertools) simplemente no lo usa.
  protected shouldLog(level: LogLevel): boolean {
    if (this.level === undefined) return true;
    return LOG_LEVEL_SEVERITY[level] >= LOG_LEVEL_SEVERITY[this.level];
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

// No filtra por nivel a propósito: `super()` sin `level` deja `shouldLog` en "pasa todo" y el
// filtrado real lo aplica el logger delegado, que es el que conoce su propio umbral. Filtrar acá
// también significaría descartar mensajes dos veces con dos umbrales potencialmente distintos.
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
