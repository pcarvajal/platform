import type { StandardSchemaV1 } from "@platform/core";
import { validateStandardSchema } from "@platform/core";
import { EnvValidationError } from "./EnvValidationError.js";

export type EnvSource = Record<string, string | undefined>;

// Validates `source` (defaults to `process.env`) against any Standard Schema-compliant schema —
// this package's own `env.*` builders today, or a third-party validator (zod, valibot, arktype)
// later, with no adapter code either way. Meant to run once at startup: throws synchronously, so
// a misconfigured environment fails the process before it ever handles a request.
export function loadEnv<Schema extends StandardSchemaV1>(
  schema: Schema,
  source: EnvSource = process.env,
): StandardSchemaV1.InferOutput<Schema> {
  const result = validateStandardSchema(schema, source);
  if (!result.success) throw new EnvValidationError(result.issues);
  return result.value;
}
