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
