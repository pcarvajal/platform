import { ApplicationError } from "./ApplicationError.js";
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

// Errores que no son propios de la jerarquía de @platform/core (bugs, excepciones de terceros,
// etc.) se envuelven en UnexpectedError en vez de armar un `type`/`origin` ad-hoc, para que
// terminen con el mismo `type = "UnexpectedError"` que ya usa el resto de la plataforma.
export function toApplicationFailure(err: unknown): ApplicationResultError {
  const applicationError =
    err instanceof ApplicationError
      ? err
      : new UnexpectedError(err instanceof Error ? err.message : undefined, err);

  const { type, origin, description, data } = applicationError.toScalars();

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
