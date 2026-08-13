import {
  AWSApiGatewayEventHttpMapper,
  AWSLoggerClient,
  type AWSApiGatewayEvent,
} from "@platform/adapter-aws";
import { createHttpDispatcher } from "@platform/infrastructure";
import { ExportOrdersController } from "../../../apps/ExportOrdersController.js";
import { ListOrders } from "../../../core/application/ListOrders.js";
import { InMemoryOrderRepository } from "../../persistence/InMemoryOrderRepository.js";
import { config } from "../../env.js";

// Lambda dedicada a un solo endpoint (GET /reports/orders.csv), separada de httpHandler.ts porque
// un export completo pide otro timeout/memoria que el resto de la API. Al haber una sola ruta no
// hay nada que rutear: en vez de createLambdaHandler (que arma un HttpRouter), se componen a mano
// las dos piezas que sí hacen falta — el mapper de API Gateway y createHttpDispatcher —, tal como
// el docstring de createLambdaHandler recomienda para los casos que se salen del común.
//
// createHttpDispatcher sigue siendo obligatorio: es quien completa `request.requestId` y quien
// convierte en respuesta HTTP lo que el controller lance antes de llegar al caso de uso (p. ej. el
// UnprocessableEntityError de parseQueryParams, o el InvalidArgumentError de un `?status=` inválido).
const logger = AWSLoggerClient.fromAppContext(config);
const listOrders = new ListOrders(new InMemoryOrderRepository(), logger);
const exportOrdersController = new ExportOrdersController(listOrders);

const mapper = new AWSApiGatewayEventHttpMapper();

export const handler = createHttpDispatcher(
  (event: AWSApiGatewayEvent) => mapper.map(event),
  // Arrow en vez de pasar `exportOrdersController.handle` suelto: el método usa `this`.
  (request) => exportOrdersController.handle(request),
);
