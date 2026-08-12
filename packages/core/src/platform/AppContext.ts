import type { LogLevel } from "../application/Logger.js";

export type AppEnvironment = "development" | "staging" | "production";
// Contraparte en runtime de AppEnvironment — necesaria para validar contra ella (env.enum(APP_ENVIRONMENTS)
// en @platform/env's env.appContext), ya que el union por sí solo no existe en tiempo de ejecución.
export const APP_ENVIRONMENTS = [
  "development",
  "staging",
  "production",
] as const satisfies readonly AppEnvironment[];

// Contexto de aplicación: identidad del servicio + entorno + nivel de log, resuelto una sola vez
// al arrancar el proceso (infrastructure/env.ts, vía @platform/env's env.appContext) y propagado
// por inyección manual — mismo patrón que RequestContext, pero de vida "todo el proceso" en vez de
// "un request". Las propiedades adicionales de cada proyecto se agregan por intersección en el
// punto de uso (ver env.appContext), no acá, para no atar este tipo a cómo se construye.
export interface AppContext {
  readonly APP_SERVICE_NAME: string;
  readonly APP_ENVIRONMENT: AppEnvironment;
  readonly APP_LOG_LEVEL: LogLevel;
}
