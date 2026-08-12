import { env, loadEnv } from "@platform/env";

// env.appContext agrega APP_SERVICE_NAME/APP_ENVIRONMENT/APP_LOG_LEVEL, obligatorios en todo
// proyecto sobre esta convención (ver platform/SKILL.md § env) — se extiende con las vars propias
// de este proyecto, como PORT acá.
const schema = env.appContext({
  PORT: env.port().default(3000),
});

export const config = loadEnv(schema);
