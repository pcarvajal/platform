import type { AppContext, StandardSchemaV1 } from "@platform/core";
import { LOG_LEVELS } from "@platform/core";
import { enumOf, string } from "./schema/primitives.js";
import { object } from "./schema/object.js";

type Shape = Record<string, StandardSchemaV1>;
type InferShape<S extends Shape> = { [K in keyof S]: StandardSchemaV1.InferOutput<S[K]> };

// Preset de @platform/env para el contexto de aplicación obligatorio (SKILL.md § env):
// APP_SERVICE_NAME, APP_ENVIRONMENT, APP_LOG_LEVEL. `extra` se spreadea PRIMERO para que esas tres
// keys fijas siempre ganen si `extra` intenta redeclararlas — extender agrega campos propios del
// proyecto, no permite debilitar los tres obligatorios.
export function appContext<S extends Shape = Record<string, never>>(
  extra: S = {} as S,
): StandardSchemaV1<Record<string, string | undefined>, AppContext & InferShape<S>> {
  return object({
    ...extra,
    APP_SERVICE_NAME: string(),
    APP_ENVIRONMENT: string(),
    APP_LOG_LEVEL: enumOf(LOG_LEVELS),
  }) as StandardSchemaV1<Record<string, string | undefined>, AppContext & InferShape<S>>;
}
