import type { StandardSchemaV1 } from "@platform/core";

type Validate<Output> = (value: unknown) => StandardSchemaV1.Result<Output>;

// Wraps a single validate function per instance; `.optional()`/`.default()` return a *new*
// instance composed around the current one (closures, not subclassing) — no inheritance chain.
export class EnvValueSchema<Output> implements StandardSchemaV1<unknown, Output> {
  readonly "~standard": StandardSchemaV1.Props<unknown, Output>;
  private readonly validateSync: Validate<Output>;

  constructor(validate: Validate<Output>) {
    this.validateSync = validate;
    this["~standard"] = { version: 1, vendor: "@platform/env", validate };
  }

  optional(): EnvValueSchema<Output | undefined> {
    const validate = this.validateSync;
    return new EnvValueSchema<Output | undefined>((value) => {
      if (value === undefined || value === "") return { value: undefined };
      return validate(value);
    });
  }

  default(fallback: Output): EnvValueSchema<Output> {
    const validate = this.validateSync;
    return new EnvValueSchema<Output>((value) => {
      if (value === undefined || value === "") return { value: fallback };
      return validate(value);
    });
  }
}
