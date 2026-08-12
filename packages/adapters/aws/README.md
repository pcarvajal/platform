# @platform/adapter-aws

Implementación de referencia de la plataforma para correr un servicio como AWS Lambda detrás de
API Gateway (REST o HTTP API, v1 y v2).

Referencia completa: ver [`platform/SKILL.md`](../../skills/platform/SKILL.md)
§ `infrastructure/deployment/`, tabla de primitivas HTTP.

## Qué provee

| Export                         | Implementa                                                          | Uso                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createLambdaHandler(routes)`  | —                                                                   | Empaqueta `HttpRouter` + `AWSApiGatewayEventHttpMapper` + `createHttpDispatcher` en el handler que exporta el Lambda.                                          |
| `AWSApiGatewayEventHttpMapper` | `HttpRequestMapper<APIGatewayProxyEvent \| APIGatewayProxyEventV2>` | Detecta automáticamente v1 vs v2 (`"rawPath" in event`) y normaliza a `HttpRequest`.                                                                           |
| `AWSLoggerClient`              | `Logger` (`@platform/core`)                                         | Envuelve `@aws-lambda-powertools/logger`, con el enmascarado de campos sensibles de `Logger` ya aplicado sobre el `context` antes de pasarlo al logger de AWS. |

```ts
// infrastructure/deployment/aws/handler.ts
import { createLambdaHandler, AWSLoggerClient } from "@platform/adapter-aws";
import type { HttpRoute } from "@platform/infrastructure";

const logger = new AWSLoggerClient({ serviceName: "orders-api" });
const routes: HttpRoute[] = [/* ... */];

export const handler = createLambdaHandler(routes);
```

Errores malformados del propio evento de API Gateway (payload que no matchea ni v1 ni v2 — típico
de un Lambda invocado por algo que no es API Gateway, p. ej. un ALB o un invoke directo) se señalan
como `MalformedApiGatewayEventError` (`AdapterError`), nunca como una excepción genérica.

Para un mapper o dispatcher distinto al default, compone `HttpRouter` + `createHttpDispatcher` a
mano en vez de `createLambdaHandler`.

## Consumo

`"@platform/adapter-aws": "workspace:*"` (o `file:../../platform/packages/adapters/aws`) — ver
[README raíz](../../../README.md) § Instalación. Solo si el deployment target es AWS Lambda /
API Gateway.
