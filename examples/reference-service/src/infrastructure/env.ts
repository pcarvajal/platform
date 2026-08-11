import { env, loadEnv } from "@platform/env";

const schema = env.object({
  PORT: env.port().default(3000),
});

export const config = loadEnv(schema);
