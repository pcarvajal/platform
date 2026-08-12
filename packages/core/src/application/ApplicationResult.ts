import { ExtensibleError } from "../platform/index.js";
import { UnexpectedError } from "./UnexpectedError.js";

export type ApplicationResultSuccess<T> = {
  ok: true;
  data: T;
};

export type ApplicationResultError = {
  ok: false;
  error: {
    type: string;
    origin?: string;
    message: string;
    data?: Record<string, unknown>;
  };
};

export type ApplicationResult<T> = ApplicationResultSuccess<T> | ApplicationResultError;

export function toApplicationSuccess<T>(data: T): ApplicationResultSuccess<T> {
  return { ok: true, data };
}

// Cualquier error del punto de extensión público (ApplicationError/DomainError/HttpError, todos
// ExtensibleError — ver SKILL.md § Jerarquía de errores) conserva su type/origin/data propios.
// PlatformError/AdapterError (errores DE la librería, no de negocio) y cualquier otra excepción
// (bugs, terceros) se envuelven en UnexpectedError en vez de armar un `type`/`origin` ad-hoc.
export function toApplicationFailure(err: unknown): ApplicationResultError {
  const structuredError =
    err instanceof ExtensibleError
      ? err
      : new UnexpectedError(err instanceof Error ? err.message : undefined, err);

  const { type, origin, description, data } = structuredError.toScalars();

  return {
    ok: false,
    error: {
      type,
      ...(origin !== undefined && { origin }),
      message: description,
      ...(Object.keys(data).length > 0 && { data }),
    },
  };
}

// Evita el `if (result.ok) { ... } else { ... }` repetido en código que consume un
// ApplicationResult fuera de un controller HTTP (donde ya existe toHttpResponse) — un listener de
// eventos, un job, un test.
export function matchApplicationResult<T, R>(
  result: ApplicationResult<T>,
  handlers: {
    onSuccess: (data: T) => R;
    onError: (error: ApplicationResultError["error"]) => R;
  },
): R {
  return result.ok ? handlers.onSuccess(result.data) : handlers.onError(result.error);
}
