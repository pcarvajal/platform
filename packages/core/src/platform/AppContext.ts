import type { LogLevel } from "../application/Logger.js";

// Contexto de aplicación: identidad del servicio + entorno + nivel de log, resuelto una sola vez
// al arrancar el proceso (infrastructure/env.ts, vía @platform/env's env.appContext) y propagado
// por inyección manual — mismo patrón que RequestContext, pero de vida "todo el proceso" en vez de
// "un request". Las propiedades adicionales de cada proyecto se agregan por intersección en el
// punto de uso (ver env.appContext), no acá, para no atar este tipo a cómo se construye.
export interface AppContext {
  readonly APP_SERVICE_NAME: string;
  readonly APP_ENVIRONMENT: string;
  readonly APP_LOG_LEVEL: LogLevel;
}
