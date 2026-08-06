import { ApplicationError } from "@platform/core";

export type EnvValidationIssue = {
  readonly path?: string;
  readonly message: string;
};

// Thrown once, synchronously, at process startup (inside `infrastructure/env.ts`) when the
// schema passed to `loadEnv` rejects the current environment. Never expected at request time —
// deliberately not mapped in `toHttpError`.
export class EnvValidationError extends ApplicationError {
  readonly type = "EnvValidationError";
  readonly origin = "@platform/env";

  constructor(readonly issues: readonly EnvValidationIssue[]) {
    super(EnvValidationError.describe(issues));
  }

  private static describe(issues: readonly EnvValidationIssue[]): string {
    const details = issues
      .map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message))
      .join("; ");
    return `Environment validation failed — ${details}`;
  }
}
