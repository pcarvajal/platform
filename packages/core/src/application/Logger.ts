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
}
