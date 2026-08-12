import { AWSLoggerClient, createSqsMessageHandler } from "@platform/adapter-aws";
import { processOrderPaidRoute } from "../../../apps/processOrderPaidRoute.js";
import { ProcessOrderPaid } from "../../../core/application/ProcessOrderPaid.js";
import { InMemoryOrderRepository } from "../../persistence/InMemoryOrderRepository.js";
import { config } from "../../env.js";

// Equivalente AWS de infrastructure/deployment/local/demoConsumer.ts, siguiendo el ejemplo de
// references/eventos.md § "Ejemplo: consumer SQS con idempotencia" casi literal.
//
// `idempotencyStore` in-memory (mismo doble mínimo que demoConsumer.ts) es la pieza que un
// deployment real reemplaza primero: sin persistencia entre invocaciones de Lambda, dos entregas
// del mismo mensaje en cold starts distintos no se deduplican — un proyecto real usaría
// RedisCache<boolean>/DynamoDB acá, no esta clase.
class DemoIdempotencyStore {
  private readonly processed = new Set<string>();
  async hasProcessed(key: string): Promise<boolean> {
    return this.processed.has(key);
  }
  async markProcessed(key: string): Promise<void> {
    this.processed.add(key);
  }
}

const logger = new AWSLoggerClient({ serviceName: config.APP_SERVICE_NAME });
const orderRepository = new InMemoryOrderRepository();
const idempotencyStore = new DemoIdempotencyStore();

const processOrderPaid = new ProcessOrderPaid(orderRepository, logger);

// ORDERS_PAID_QUEUE_ARN es opcional en env.ts (deployment/local no lo necesita), pero este target
// sí lo requiere en runtime — falla al cargar el módulo (cold start) en vez de silenciosamente
// caer al default de processOrderPaidRoute(), que nunca matchearía un ARN real de SQS.
if (!config.ORDERS_PAID_QUEUE_ARN) {
  throw new Error("ORDERS_PAID_QUEUE_ARN must be set to run this SQS consumer");
}

// mapSqsEvent (@platform/adapter-aws) completa `envelope.source` con `record.eventSourceARN`, así
// que el `source` pasado acá tiene que matchear ese mismo valor para que bySource() lo reconozca.
export const handler = createSqsMessageHandler([
  processOrderPaidRoute(processOrderPaid, idempotencyStore, config.ORDERS_PAID_QUEUE_ARN),
]);
