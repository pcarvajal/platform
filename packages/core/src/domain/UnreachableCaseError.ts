import { DomainError } from "./DomainError.js";

// Raised by `assertNever` when a value reaches a branch TypeScript proved unreachable (typically
// an exhaustive switch over a union) — signals the type and the runtime value have drifted apart,
// e.g. a new union member was added without updating every switch that handles it.
export class UnreachableCaseError extends DomainError {
  type = "UnreachableCaseError";
  readonly origin = "@platform/core";
  constructor(value: never) {
    super(`Unreachable case reached with value: ${JSON.stringify(value)}`);
  }
}
