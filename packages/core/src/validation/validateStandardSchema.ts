import type { StandardSchemaV1 } from "./StandardSchema.js";

export type StandardSchemaIssue = {
  readonly path?: string;
  readonly message: string;
};

export type StandardSchemaValidation<Output> =
  | { readonly success: true; readonly value: Output }
  | { readonly success: false; readonly issues: readonly StandardSchemaIssue[] };

function toIssue(issue: StandardSchemaV1.Issue): StandardSchemaIssue {
  const path = issue.path
    ?.map((segment) => (typeof segment === "object" ? segment.key : segment))
    .join(".");
  return { path: path || undefined, message: issue.message };
}

// Shared by every `@platform/*` validation entry point (`env.loadEnv`, `infrastructure`'s HTTP
// request validators) so the sync/async handling and issue-path flattening live in one place.
export function validateStandardSchema<Schema extends StandardSchemaV1>(
  schema: Schema,
  value: unknown,
): StandardSchemaValidation<StandardSchemaV1.InferOutput<Schema>> {
  const result = schema["~standard"].validate(value);

  if (result instanceof Promise) {
    return {
      success: false,
      issues: [{ message: "Async schemas are not supported — validation must be synchronous" }],
    };
  }

  if (result.issues) {
    return { success: false, issues: result.issues.map(toIssue) };
  }

  return { success: true, value: result.value };
}
