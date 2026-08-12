import { env, loadEnv } from "@platform/env";

// env.appContext agrega APP_SERVICE_NAME/APP_ENVIRONMENT/APP_LOG_LEVEL, obligatorios en todo
// proyecto sobre esta convención (ver platform/SKILL.md § env) — se extiende con las vars propias
// de este proyecto, como PORT acá.
//
// Las tres siguientes son integraciones opcionales (ver README § "Integraciones opcionales"): el
// proyecto arranca y sirve los tres endpoints sin ninguna de ellas configurada.
const schema = env.appContext({
  PORT: env.port().default(3000),
  // Si está seteada, GET /orders/:id cachea su respuesta en Redis (RedisHttpResponseCache, ver
  // @platform/adapter-redis) — sin ella, ese endpoint no cachea nada.
  REDIS_URL: env.url().optional(),
  // Si está seteada, ShipOrder notifica a este sistema externo tras despachar (NodeFetchRestClient,
  // ver @platform/adapter-node) — sin ella, ShipOrder sigue funcionando, solo que sin notificar.
  SHIPPING_PROVIDER_URL: env.url().optional(),
  // ARN real de la cola SQS en AWS (ver infrastructure/deployment/aws/orderPaidConsumer.ts) — no
  // se usa en deployment/local, donde processOrderPaidRoute() usa su propio default.
  ORDERS_PAID_QUEUE_ARN: env.string().optional(),
});

export const config = loadEnv(schema);
