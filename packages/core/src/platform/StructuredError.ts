// `Error#cause` is installed as a non-enumerable own property by the JS runtime, so
// `Object.entries(this)` in `toScalars()` never sees it — it has to be read via `this.cause` and
// serialized explicitly instead. `StructuredError` causes recurse through `toScalars()` so a chain
// of wrapped platform/application errors stays structured instead of collapsing to `[object Object]`.
function serializeCause(cause: unknown): unknown {
  if (cause instanceof StructuredError) return cause.toScalars();
  if (cause instanceof Error)
    return { name: cause.name, message: cause.message, stack: cause.stack };
  return cause;
}

export abstract class StructuredError extends Error {
  abstract readonly type: string;
  origin?: string;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
  }

  toScalars(): {
    type: string;
    origin?: string;
    description: string;
    data: Record<string, unknown>;
  } {
    const props = Object.entries(this).filter(
      ([key, _]) => key !== "type" && key !== "origin" && key !== "message",
    );

    return {
      type: this.type,
      origin: this.origin,
      description: this.message,
      data: {
        ...props.reduce((acc, [key, value]) => {
          return { ...acc, [key]: value };
        }, {}),
        ...(this.cause !== undefined && { cause: serializeCause(this.cause) }),
      },
    };
  }
}
