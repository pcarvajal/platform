# Composición manual, cuándo abstraer y anti-patrones

> Referencia de `platform/SKILL.md`. Ver el índice para cuándo leer cada archivo de
> `references/`.

## Bootstrap de un proyecto nuevo (`@platform/create-app`)

`node packages/create-app/dist/src/cli.js <nombre-proyecto> [--platform-path <ruta-a-platform>]`
genera el árbol completo de [`estructura.md`](./estructura.md) para el caso común (servidor HTTP
local): `src/{apps,core/application,infrastructure/{env.ts,deployment/local/server.ts},index.ts}`,
`package.json`/`tsconfig.json`/`eslint.config.js` ya cableados, y **copia** (no referencia con
`file:` — ver SKILL.md § Instalación) los paquetes `@platform/*` necesarios a `packages/` dentro de
un `pnpm-workspace.yaml` propio, con un `postinstall` que los compila en orden de dependencia. Es
la automatización de la vía de instalación que hoy funciona de punta a punta; reemplaza seguir la
lista de `SKILL.md` § Instalación a mano para el caso inicial. `pnpm install && pnpm run doctor`
en el proyecto generado no debería reportar nada faltante ni fuera de convención.

No incluye `packages/adapters/aws` por defecto (solo Node local) — copiarlo a mano si el proyecto
además despliega a Lambda, ver el `README.md` que el propio generador escribe en el proyecto.

### `doctor`/`eslint-config` — verificar que el proyecto respeta la convención

`@platform/doctor` (CLI standalone, corre desde el `dist/` de un proyecto consumidor — no en este
monorepo) chequea el `src/` de ese proyecto contra la convención de [`estructura.md`](./estructura.md)
por filesystem, sin AST:

```sh
pnpm exec doctor [path/to/src]   # default: ./src
```

Reporta carpetas/archivos requeridos que faltan, cualquier cosa fuera de la convención, y advierte
si detecta un paquete de contenedor de DI (`tsyringe`, `inversify`, `awilix`, `reflect-metadata`)
instalado — la señal de que se está a punto de romper la regla "composición manual por defecto" (ver
Filosofía en `SKILL.md`). No reemplaza a `@platform/eslint-config`, que corre en cada build/CI y
hace cumplir la dirección de dependencias (`boundaries/element-types`) y las dos reglas
`no-restricted-syntax` (nunca extender `PlatformError`/`AdapterError` desde el proyecto, nunca leer
`process.env` fuera de `infrastructure/env.ts`) a nivel de AST — `doctor` solo ve la estructura de
carpetas/archivos, no el contenido del código. Un proyecto nuevo generado con `create-app` (abajo)
ya trae ambos wireados; en un proyecto existente, copiar `packages/eslint-config` y extenderlo desde
el propio `eslint.config.js` es la otra mitad de esta verificación.

### `doctor generate:*` — generar código nuevo ya correcto por construcción

Dentro de un proyecto existente, `doctor` no solo verifica la convención — también genera las
formas por defecto documentadas en [`usecase.md`](./usecase.md)/[`eventos.md`](./eventos.md), para
no tener que copiar/adaptar un ejemplo a mano (ni para un asistente de IA, ni para una persona):

| Comando                                        | Genera                                                                                                     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `doctor generate:usecase <Nombre> [srcDir]`    | `<srcDir>/core/application/<Nombre>.ts` — un `BaseUseCase` con `<Nombre>Command` y `handle` a completar.   |
| `doctor generate:controller <Nombre> [srcDir]` | `<srcDir>/apps/<nombre>Route.ts` — un `HttpRoute` vía `route()`, importando el `UseCase` del mismo nombre. |
| `doctor generate:consumer <Nombre> [srcDir]`   | `<srcDir>/apps/<nombre>Route.ts` — un `MessageRoute` vía `bySource()`, mismo `UseCase`.                    |

`srcDir` por defecto es `"src"`, igual que el check normal de `doctor`. Ninguno de los tres pisa un
archivo existente — falla en vez de sobreescribir. El caso de uso se genera primero
(`generate:usecase`); `generate:controller`/`generate:consumer` esperan que `<Nombre>` ya exista en
`core/application/`. `generate:consumer` importa tanto la clase `<Nombre>` como su tipo
`<Nombre>Command` (necesita el segundo para castear `envelope.body`); `generate:controller` solo
importa la clase `<Nombre>` — el body del request se valida contra un schema de zod aparte, no
contra `<Nombre>Command` directamente.

## Ejemplo end-to-end

Nada de contenedores de DI. Cada `deployment/*` cablea a mano sus dependencias y se las pasa al
`app`:

```ts
// src/infrastructure/deployment/local/server.ts
import type { HttpRoute } from "@platform/infrastructure";
import { startLocalServer, NodeConsoleLoggerClient } from "@platform/adapter-node";
import { createOrderRoute } from "../../../apps/createOrderRoute.js";
import { getOrderRoute } from "../../../apps/getOrderRoute.js";
import { CreateOrder } from "../../../core/application/CreateOrder.js";
import { GetOrder } from "../../../core/application/GetOrder.js";
import { InMemoryOrderRepository } from "../../persistence/InMemoryOrderRepository.js";

const logger = new NodeConsoleLoggerClient();
const orderRepository = new InMemoryOrderRepository();

// El ruteo real vive acá — es lo único específico del proyecto en este archivo.
const routes: HttpRoute[] = [
  createOrderRoute(new CreateOrder(orderRepository, logger)),
  getOrderRoute(new GetOrder(orderRepository, logger)),
];

// startLocalServer empaqueta HttpRouter + NodeHttpRequestMapper + createHttpDispatcher +
// NodeHttpServer.listen — sigue siendo composición manual, solo agrupada en una llamada.
await startLocalServer(routes, { port: 3000 });
```

`createOrderRoute`/`getOrderRoute` son la forma por defecto (`route()`, ver
[`usecase.md`](./usecase.md)); si un endpoint necesita más que "parsear, ejecutar, traducir", esa
entrada de `routes` puede ser un controller-clase manual en su lugar sin que el resto del wiring
cambie — `HttpRoute["handle"]` es la misma firma en ambos casos.

Cambiar de `deployment/local` a `deployment/aws` significa escribir un handler nuevo que cablea
`createLambdaHandler` (mismos `routes`, mismo shape) + `AWSLoggerClient` en vez de sus equivalentes
Node:

```ts
// src/infrastructure/deployment/aws/handler.ts
import { createLambdaHandler } from "@platform/adapter-aws";
// ... mismo cableado de controllers/casos de uso que arriba, con AWSLoggerClient en vez de
// NodeConsoleLoggerClient, y los mismos `routes` (HttpRoute no depende de ningún SDK).
export const handler = createLambdaHandler(routes);
```

**`apps/` y `core/` no cambian una línea** — el `HttpRoute[]` y los `route()`/`controller.handle` son
los mismos en ambos entornos.

## Cuándo SÍ / NO crear una abstracción

| Señal                                                                       | Acción                                                                                                           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Vas a tener DynamoDB hoy y Postgres el próximo trimestre                    | Interfaz de repositorio en `application`, implementaciones en `persistence/`                                     |
| Necesitas testear el caso de uso sin red/DB real                            | Interfaz + implementación in-memory para tests                                                                   |
| "Por si en el futuro cambiamos de proveedor" sin plan concreto              | **No** crear la interfaz todavía                                                                                 |
| Una sola implementación, sin necesidad de test doble, sin plan de reemplazo | Clase concreta directa, sin interfaz                                                                             |
| Necesitas un error de negocio/HTTP propio del proyecto                      | Extender `ApplicationError`/`DomainError`/`HttpError` — nunca `PlatformError` (ver [`errores.md`](./errores.md)) |

## Anti-patrones

- Reglas de negocio dentro de `infrastructure/` o `apps/` (deberían vivir en `core/domain` o
  `core/application`).
- `core/` importando algo de `infrastructure/` (la flecha de dependencia va al revés).
- Interfaces creadas sin una segunda implementación real ni un test doble que las use.
- Contenedor de DI (`tsyringe`, `inversify`, decoradores `@Injectable`) introducido sin haber
  sentido primero el dolor de la composición manual.
- `shared/` usado como repositorio de utilidades genéricas entre proyectos — eso pertenece a `core`
  o `infrastructure` de este monorepo.
- Leer `process.env` fuera de `infrastructure/env.ts`.
- Extender `PlatformError`/`AdapterError` desde el código del proyecto — esa rama es exclusiva de
  estas librerías (ver [`errores.md`](./errores.md)).
- Un `UseCase.execute`/`BaseUseCase.handle` que lanza un error de negocio esperado en vez de
  devolverlo como `ApplicationResult` (ver [`usecase.md`](./usecase.md)) — rompe el contrato para
  quien lo llama, que ya no puede confiar en que `execute` no lanza.
