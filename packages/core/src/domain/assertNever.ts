import { UnreachableCaseError } from "./UnreachableCaseError.js";

export function assertNever(x: never): never {
  throw new UnreachableCaseError(x);
}
