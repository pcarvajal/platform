import type { StandardSchemaV1 } from "@platform/core";
import { EnvValueSchema } from "./EnvValueSchema.js";

export function string(): EnvValueSchema<string> {
  return new EnvValueSchema<string>((value) => {
    if (typeof value !== "string" || value === "") {
      return { issues: [{ message: "expected a non-empty string" }] };
    }
    return { value };
  });
}

export function number(): EnvValueSchema<number> {
  return new EnvValueSchema<number>((value) => {
    if (typeof value !== "string" || value === "") {
      return { issues: [{ message: "expected a numeric string" }] };
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return { issues: [{ message: `expected a number, received "${value}"` }] };
    }
    return { value: parsed };
  });
}

export function boolean(): EnvValueSchema<boolean> {
  return new EnvValueSchema<boolean>((value) => {
    if (value === "true") return { value: true };
    if (value === "false") return { value: false };
    return {
      issues: [{ message: `expected "true" or "false", received ${JSON.stringify(value)}` }],
    };
  });
}

export function enumOf<const Values extends readonly string[]>(
  values: Values,
): EnvValueSchema<Values[number]> {
  return new EnvValueSchema<Values[number]>((value) => {
    if (typeof value === "string" && (values as readonly string[]).includes(value)) {
      return { value: value as Values[number] };
    }
    return {
      issues: [
        { message: `expected one of ${values.join(", ")}, received ${JSON.stringify(value)}` },
      ],
    };
  });
}

export function url(): EnvValueSchema<string> {
  return new EnvValueSchema<string>((value) => {
    if (typeof value !== "string" || value === "") {
      return { issues: [{ message: "expected a non-empty string" }] };
    }
    try {
      new URL(value);
      return { value };
    } catch {
      return { issues: [{ message: `expected a valid URL, received "${value}"` }] };
    }
  });
}

export function port(): EnvValueSchema<number> {
  return new EnvValueSchema<number>((value) => {
    if (typeof value !== "string" || value === "") {
      return { issues: [{ message: "expected a numeric string" }] };
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      return {
        issues: [{ message: `expected a port number between 1 and 65535, received "${value}"` }],
      };
    }
    return { value: parsed };
  });
}

// Splits on `separator` (default ",") and validates each token against `itemSchema` — any
// Standard Schema, not just this package's own builders (e.g. a zod schema per item).
export function array<Schema extends StandardSchemaV1>(
  itemSchema: Schema,
  options: { separator?: string } = {},
): EnvValueSchema<StandardSchemaV1.InferOutput<Schema>[]> {
  const separator = options.separator ?? ",";

  return new EnvValueSchema<StandardSchemaV1.InferOutput<Schema>[]>((value) => {
    if (typeof value !== "string" || value === "") {
      return { issues: [{ message: "expected a non-empty string" }] };
    }

    const tokens = value.split(separator).map((token) => token.trim());
    const items: StandardSchemaV1.InferOutput<Schema>[] = [];
    const issues: StandardSchemaV1.Issue[] = [];

    tokens.forEach((token, index) => {
      const result = itemSchema["~standard"].validate(token);
      if (result instanceof Promise) {
        issues.push({ path: [index], message: "async item schemas are not supported" });
        return;
      }
      if (result.issues) {
        for (const issue of result.issues) {
          issues.push({ path: [index, ...(issue.path ?? [])], message: issue.message });
        }
        return;
      }
      items.push(result.value);
    });

    if (issues.length > 0) return { issues };
    return { value: items };
  });
}

// Parses `value` as JSON and, if `schema` is given, validates the parsed value against it (any
// Standard Schema) — same two-step shape as `parseJsonBody` (infrastructure): parse first,
// validate second, so JSON syntax errors and shape mismatches surface as distinct issues.
export function json(): EnvValueSchema<unknown>;
export function json<Schema extends StandardSchemaV1>(
  schema: Schema,
): EnvValueSchema<StandardSchemaV1.InferOutput<Schema>>;
export function json(schema?: StandardSchemaV1): EnvValueSchema<unknown> {
  return new EnvValueSchema<unknown>((value) => {
    if (typeof value !== "string" || value === "") {
      return { issues: [{ message: "expected a non-empty string" }] };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      return { issues: [{ message: `expected valid JSON, received "${value}"` }] };
    }

    if (!schema) return { value: parsed };

    const result = schema["~standard"].validate(parsed);
    if (result instanceof Promise) {
      return { issues: [{ message: "async schemas are not supported" }] };
    }
    return result;
  });
}
