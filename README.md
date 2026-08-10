# platform

Monorepo de utilidades, clases compartidas y convenciones de arquitectura para construir servicios sobre una base común:
arquitectura hexagonal + DDD, TypeScript estricto, y una jerarquía de errores y de resultados consistente en toda la pila.
Evita dentro de lo posible la dependencia de librerías de terceros, para que cada proyecto pueda elegir sus propias implementaciones,
dando soporte básico a lo esencial (HTTP, validación, logging, etc.) y dejando que cada proyecto decida si quiere usar
librerías más pesadas (zod, valibot, axios, etc.) para casos de uso más avanzados, logrando así un equilibrio entre consistencia,
simplicidad y flexibilidad.

## Qué incluye

| Paquete                    | Qué resuelve                                                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@platform/core`           | Dominio y aplicación: primitivas DDD (`ValueObject`, `AggregateRoot`, `Uuid`, `DomainEvent`), jerarquía de errores, `UseCase`/`ApplicationResult`, validación con Standard Schema. |
| `@platform/infrastructure` | HTTP: `HttpRouter`, `createHttpDispatcher`, `HttpError` + subclases, `toHttpResponse`, `RestClient`, `EventBus`, `HttpResponseCache`/`withHttpCache`.                              |
| `@platform/env`            | Carga y validación tipada de `process.env`, sin dependencias de terceros por defecto.                                                                                              |
| `@platform/adapter-node`   | Implementación de referencia para correr un servicio como servidor HTTP local con Node; incluye `InMemoryEventBus`.                                                                |
| `@platform/adapter-aws`    | Implementación de referencia para correr un servicio como Lambda detrás de API Gateway.                                                                                            |
| `@platform/adapter-redis`  | Redis: `RedisHttpResponseCache` (implementa `HttpResponseCache` de `infrastructure`) — read-through cache de respuestas HTTP con degradación a cache miss si Redis falla.          |
| `@platform/eslint-config`  | Reglas de ESLint que verifican en CI la dirección de dependencias entre capas y los anti-patrones documentados.                                                                    |
| `@platform/doctor`         | CLI que confirma que la estructura de carpetas de un proyecto sigue la convención esperada.                                                                                        |
| `@platform/testing`        | Dobles de test: `InMemoryRepository`, `FakeLogger`, `buildHttpRequest`; reexporta `InMemoryEventBus` (adapter-node) para no reescribir los mismos fakes en cada proyecto.          |

La convención completa vive en `packages/skills/company-platform/SKILL.md`; este README cubre el
resumen y un ejemplo end-to-end.

## Por qué

- **Explícito, sin magia oculta.** Composición manual por defecto: sin contenedores de inyección de
  dependencias, sin decoradores, sin descubrimiento automático de componentes. El flujo de ejecución se
  sigue leyendo el código.
- **Una sola jerarquía de errores, en toda la pila.** Todo error (de librería o de proyecto) comparte
  `toScalars()`, así que se loguea y se serializa igual sin armar el payload a mano, y las propiedades
  propias de cada error (`orderId`, `ticketId`, etc.) viajan automáticamente.
- **Result estándar en la capa de aplicación.** Todo caso de uso implementa `UseCase` y devuelve un
  `ApplicationResult` en vez de lanzar errores de negocio esperados, `toHttpResponse` lo traduce
  directo a la respuesta HTTP correcta, sin que cada controller repita ese mapeo.
- **Mismo dominio, distintos entornos de despliegue.** El código de `apps/` y `core/` no cambia entre
  correr como servidor Node local o como Lambda, solo cambia el adaptador de `infrastructure/deployment`.
- **Arquitectura verificable, no solo documentada.** `@platform/eslint-config` bloquea imports que
  rompen la dirección de dependencias entre capas. `@platform/doctor` confirma que la estructura de
  carpetas existe donde se espera.
- **TypeScript estricto de punta a punta**, módulos ESM nativos (`NodeNext`), sin dependencias pesadas
  por defecto (parseo de `.env` propio, validación desacoplada de cualquier librería concreta vía
  Standard Schema — compatible con zod, valibot o arktype sin cambiar el resto del código).

## Estructura de carpetas

Todo proyecto construido sobre esta plataforma sigue la misma convención de carpetas y la misma
dirección de dependencias — es justamente lo que `@platform/eslint-config` bloquea en tiempo de lint y
`@platform/doctor` verifica en el filesystem:

```
src
├── apps                   # requerido. Puntos de entrada (HTTP, eventos, cron): adaptan una
│                          # interacción externa a un caso de uso. Sin reglas de negocio ni SDKs.
├── core
│   ├── application        # requerido. Orquesta casos de uso (UseCase + ApplicationResult).
│   │                      # No depende de infraestructura para poder testearse sin red/DB real.
│   │                      # Sin reglas de negocio ni SDKs.
│   └── domain             # opcional. Entidades, value objects, reglas de negocio. Solo existe
│                          # si el proyecto tiene lógica de negocio propia que modelar.
├── infrastructure
│   ├── deployment
│   │   ├── aws            # opcional. Solo si el target de despliegue es en AWS
│   │   └── local          # opcional. Solo si el target de despliegue es local.
│   ├── clients            # opcional. Solo si el proyecto habla con sistemas externos (REST,
│   │                      # brokers, SFTP...).
│   ├── persistence        # opcional. Solo si el proyecto implementa sus propios repositorios
│   │                      # (DynamoDB, Postgres...) en vez de delegarlo todo a `clients/`.
│   └── env.ts             # requerido. Único punto de lectura de `process.env` en todo el
│                          # proyecto — el resto recibe configuración ya parseada por inyección.
├── shared                 # opcional. Utilidades exclusivas de este proyecto — no es un cajón
│                          # genérico, lo reutilizable entre proyectos va a `@platform/*`.
└── index.ts               # requerido. Barrel de exports públicos de la aplicación, sin lógica
                           # de arranque (eso vive en `infrastructure/deployment/*`).
```

```
deployment
      ↓
apps
      ↓
application
      ↓
domain
```

Las flechas solo van hacia el núcleo: `domain` no depende de nada de `application`/`infrastructure`, y
`application` no depende de `infrastructure`/`apps`. Es la razón detrás de la ubicación de cada carpeta
arriba: cuanto más cerca del negocio, menos debe saber sobre cómo se despliega o se expone.

## Ejemplo: un servicio de tickets mínimo

Un endpoint que crea un ticket de soporte, siguiendo la estructura `apps → core/application →
core/domain`, con persistencia en memoria e HTTP local.

**`core/domain/Ticket.ts`** — regla de negocio, sin dependencias externas:

```ts
import { randomUUID } from "node:crypto";
import { Uuid } from "@platform/core";

export class TicketId extends Uuid {}

export class Ticket {
  private constructor(
    readonly id: TicketId,
    readonly subject: string,
    readonly status: "open" | "closed",
  ) {}

  static open(subject: string): Ticket {
    return new Ticket(new TicketId(randomUUID()), subject, "open");
  }
}
```

**`core/application/CreateTicket.ts`** — orquesta el caso de uso, devuelve `ApplicationResult`:

```ts
import {
  UseCase,
  ApplicationResult,
  Logger,
  toApplicationSuccess,
  toApplicationFailure,
} from "@platform/core";
import { Ticket } from "../domain/Ticket.js";
import type { TicketRepository } from "./TicketRepository.js";

export type CreateTicketCommand = { subject: string };

export class CreateTicket implements UseCase<CreateTicketCommand, Ticket> {
  constructor(
    private readonly tickets: TicketRepository,
    private readonly logger: Logger,
  ) {}

  async execute(command: CreateTicketCommand): Promise<ApplicationResult<Ticket>> {
    try {
      const ticket = Ticket.open(command.subject);
      await this.tickets.save(ticket);
      return toApplicationSuccess(ticket);
    } catch (err) {
      this.logger.error("CreateTicket failed", { err });
      return toApplicationFailure(err);
    }
  }
}
```

**`infrastructure/persistence/InMemoryTicketRepository.ts`** — implementa el repositorio que pide
`application`:

```ts
import type { Ticket } from "../../core/domain/Ticket.js";
import type { TicketRepository } from "../../core/application/TicketRepository.js";

export class InMemoryTicketRepository implements TicketRepository {
  private readonly tickets = new Map<string, Ticket>();

  async save(ticket: Ticket): Promise<void> {
    this.tickets.set(ticket.id.value, ticket);
  }
}
```

**`apps/CreateTicketController.ts`** — traduce HTTP al caso de uso, y el `ApplicationResult` de vuelta
a HTTP:

```ts
import {
  parseJsonBody,
  toHttpResponse,
  type HttpRequest,
  type HttpResponse,
} from "@platform/infrastructure";
import { z } from "zod";
import { CreateTicket } from "../core/application/CreateTicket.js";

const CreateTicketBody = z.object({ subject: z.string().min(1) });

export class CreateTicketController {
  constructor(private readonly createTicket: CreateTicket) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const body = parseJsonBody(request, CreateTicketBody);
    const result = await this.createTicket.execute(body);
    return toHttpResponse(result, { successStatusCode: 201 });
  }
}
```

**`infrastructure/deployment/local/server.ts`** — composición manual, sin contenedor de DI:

```ts
import { startLocalServer, NodeConsoleLoggerClient } from "@platform/adapter-node";
import type { HttpRoute } from "@platform/infrastructure";
import { CreateTicketController } from "../../../apps/CreateTicketController.js";
import { CreateTicket } from "../../../core/application/CreateTicket.js";
import { InMemoryTicketRepository } from "../../persistence/InMemoryTicketRepository.js";

const logger = new NodeConsoleLoggerClient();
const tickets = new InMemoryTicketRepository();
const createTicketController = new CreateTicketController(new CreateTicket(tickets, logger));

const routes: HttpRoute[] = [
  { method: "POST", path: "/tickets", handle: (req) => createTicketController.handle(req) },
];

await startLocalServer(routes, { port: 3000 });
```

Cambiar este mismo servicio a AWS Lambda es escribir un `infrastructure/deployment/aws/handler.ts`
que cablea `createLambdaHandler` con las mismas `routes` y el mismo `AWSLoggerClient` en vez de
`NodeConsoleLoggerClient` — `apps/` y `core/` no cambian una línea.

## Documentación

`packages/skills/company-platform/SKILL.md` es la referencia completa: estructura de carpetas,
dirección de dependencias, jerarquía de errores, convención de `UseCase`/`ApplicationResult`, y la
lista de anti-patrones que `@platform/eslint-config` y `@platform/doctor` verifican.
