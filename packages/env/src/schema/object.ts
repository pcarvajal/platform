import type { StandardSchemaV1 } from "@platform/core";

type Shape = Record<string, StandardSchemaV1>;
type InferShape<S extends Shape> = { [K in keyof S]: StandardSchemaV1.InferOutput<S[K]> };

export function object<S extends Shape>(
  shape: S,
): StandardSchemaV1<Record<string, string | undefined>, InferShape<S>> {
  return {
    "~standard": {
      version: 1,
      vendor: "@platform/env",
      validate(input: unknown) {
        const source = (input ?? {}) as Record<string, string | undefined>;
        const value: Record<string, unknown> = {};
        const issues: StandardSchemaV1.Issue[] = [];

        for (const key of Object.keys(shape)) {
          const fieldResult = shape[key]["~standard"].validate(source[key]);
          if (fieldResult instanceof Promise) {
            issues.push({ path: [key], message: "async field schemas are not supported" });
            continue;
          }
          if (fieldResult.issues) {
            for (const issue of fieldResult.issues) {
              issues.push({ path: [key, ...(issue.path ?? [])], message: issue.message });
            }
            continue;
          }
          value[key] = fieldResult.value;
        }

        if (issues.length > 0) return { issues };
        return { value: value as InferShape<S> };
      },
    },
  };
}
