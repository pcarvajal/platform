// Mirrors the Standard Schema spec (https://standardschema.dev, v1) verbatim. This is the
// interop surface every validation entry point in `@platform/*` (`env.loadEnv`,
// `infrastructure`'s HTTP request validators) checks against instead of any concrete validator's
// API — any library that implements it (zod >=3.24, valibot, arktype, and this monorepo's own
// `@platform/env` builders) can be passed in with zero adapter code.
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

// The namespace-merged-with-interface shape is how the spec itself is published — keeping it
// verbatim is what makes this a drop-in match for zod/valibot/arktype's own copy of the same type.
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
    readonly types?: Types<Input, Output> | undefined;
  }

  export type Result<Output> = SuccessResult<Output> | FailureResult;

  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }

  export interface FailureResult {
    readonly issues: readonly Issue[];
  }

  export interface Issue {
    readonly message: string;
    readonly path?: readonly (PropertyKey | PathSegment)[] | undefined;
  }

  export interface PathSegment {
    readonly key: PropertyKey;
  }

  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }

  export type InferInput<Schema extends StandardSchemaV1> = NonNullable<
    Schema["~standard"]["types"]
  >["input"];

  export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<
    Schema["~standard"]["types"]
  >["output"];
}
