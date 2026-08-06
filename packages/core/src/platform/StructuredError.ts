
export abstract class StructuredError extends Error {
  abstract type: string;
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
      data: props.reduce((acc, [key, value]) => {
        return { ...acc, [key]: value };
      }, {}),
    };
  }
}
