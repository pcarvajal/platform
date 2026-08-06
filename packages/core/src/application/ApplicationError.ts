import { ExtensibleError } from "../platform/index.js";

// Extend this for your own application error taxonomy. Deliberately not a `PlatformError` — see
// `ExtensibleError` for why.
export abstract class ApplicationError extends ExtensibleError {}
