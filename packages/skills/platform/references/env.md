# `infrastructure/env.ts` y `@platform/env`

> Referencia de `platform/SKILL.md`. Ver el índice para cuándo leer cada archivo de
> `references/`.

`infrastructure/env.ts` es el único punto donde se lee `process.env` en todo el proyecto. El resto
del código recibe configuración ya parseada/tipada por inyección manual (parámetros de constructor)
— nunca lee `process.env` directamente fuera de este archivo (`@platform/eslint-config` lo bloquea
vía `no-restricted-syntax`, ver `packages/eslint-config/index.js`).

Para no reinventar el parseo/validación a mano en cada proyecto, este archivo se apoya en
`@platform/env` (`loadEnv` + el builder `env.*`).

## Contexto de aplicación obligatorio (`env.appContext`)

Todo proyecto sobre esta convención declara un **contexto de aplicación** con tres propiedades
obligatorias — `APP_SERVICE_NAME`, `APP_ENVIRONMENT`, `APP_LOG_LEVEL` — vía `env.appContext(extra?)`
en vez de `env.object` directo. Es el mismo `object()` de siempre, con esas tres keys ya cargadas:

```ts
// src/infrastructure/env.ts
import { loadEnv, env } from "@platform/env";

// env.appContext agrega APP_SERVICE_NAME/APP_ENVIRONMENT/APP_LOG_LEVEL, obligatorios — `extra` es
// donde se extiende con las vars propias del proyecto, cualquier StandardSchemaV1 igual que
// env.object.
const schema = env.appContext({
  PORT: env.number().default(3000),
  DATABASE_URL: env.string(),
  FEATURE_X: env.boolean().optional(),
});

// loadEnv valida sincrónicamente contra process.env y tira EnvValidationError si algo falta o
// no matchea — se llama una sola vez acá, al importar el módulo, para que el proceso falle al
// arrancar (cold start de Lambda o boot del server local) y no a mitad de un request. Sin las
// tres vars de contexto, o con un APP_LOG_LEVEL fuera de debug/info/warn/error/silent, el proceso
// no arranca.
export const config = loadEnv(schema);
```

`config.APP_SERVICE_NAME` (string), `config.APP_ENVIRONMENT` (string — el proyecto define sus
propios nombres de entorno, `env.appContext` no fija un enum) y `config.APP_LOG_LEVEL` (el mismo
union `LogLevel` de `@platform/core`, ver [`Logger`](../SKILL.md)) quedan disponibles junto al
resto de `config`, igual que `PORT`/`DATABASE_URL` arriba.

**No es opcional por convención**: `@platform/doctor` valida que `infrastructure/env.ts` declare
las tres keys (chequeo de texto, no de AST — ver `packages/doctor/src/doctor.ts`) y falla si no
están, igual que valida la estructura de carpetas. `@platform/create-app` genera `env.ts` ya con
`env.appContext` por defecto, así un proyecto nuevo nace cumpliendo.

Si un proyecto necesita `env.object` sin el contexto obligatorio (poco común — pensado para el
caso general, no para `infrastructure/env.ts`), sigue disponible tal cual.

## Inventario de `@platform/env`

| Export                                                                           | Firma real                                                                                                                                                                                                                                                                               | Uso típico                                                                                                                  |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `loadEnv(schema, source?)`                                                       | `<Schema extends StandardSchemaV1>(schema: Schema, source: Record<string, string \| undefined> = process.env) => StandardSchemaV1.InferOutput<Schema>`. Valida `source` sincrónicamente; tira `EnvValidationError` si `schema` rechaza el valor.                                         | Única llamada real de `env.ts`. `source` es inyectable — útil para testear `env.ts` sin mutar `process.env` global.         |
| `env.object(shape)` / `.string()` / `.number()` / `.boolean()` / `.enum(values)` | Builder propio, sin dependencias de terceros. Cada valor soporta `.optional()` y `.default(value)`.                                                                                                                                                                                      | Uso por defecto cuando el proyecto no necesita validaciones más allá de tipo/presencia/enum.                                |
| `env.url()` / `.port()`                                                          | `url()` valida con `new URL(value)` (lanza issue si no parsea) y devuelve el string tal cual; `port()` valida un entero en el rango 1-65535.                                                                                                                                             | `DATABASE_URL: env.url()`, `PORT: env.port().default(3000)` — mismo builder, sin reinventar la validación en `env.ts`.      |
| `env.array(itemSchema, { separator? })`                                          | `<Schema extends StandardSchemaV1>(itemSchema: Schema, options?: { separator?: string }) => EnvValueSchema<InferOutput<Schema>[]>`. Separa `value` por `separator` (`","` por defecto) y valida cada token contra `itemSchema` — cualquier Standard Schema, no solo los de este builder. | `ALLOWED_ORIGINS: env.array(env.url())` para `"https://a.com,https://b.com"` sin un `.split(",")` a mano fuera de `env.ts`. |
| `env.json(schema?)`                                                              | `(schema?: StandardSchemaV1) => EnvValueSchema<unknown \| InferOutput<Schema>>`. Parsea `value` como JSON (issue si no es JSON válido) y, si se pasa `schema`, valida el resultado contra él.                                                                                            | `FEATURE_FLAGS: env.json(z.object({ betaUi: z.boolean() }))` sin un `JSON.parse` suelto fuera de `env.ts`.                  |
| `env.appContext(extra?)`                                                         | `<S extends Shape>(extra?: S) => StandardSchemaV1<..., AppContext & InferShape<S>>`. `env.object` con `APP_SERVICE_NAME`/`APP_ENVIRONMENT`/`APP_LOG_LEVEL` ya cargados; `extra` se spreadea antes que esas tres keys, así que no puede pisarlas.                                         | Preset obligatorio para `infrastructure/env.ts` — ver § "Contexto de aplicación obligatorio" arriba.                        |
| `EnvValidationError`                                                             | `extends ApplicationError` (`core`, ver [`errores.md`](./errores.md)); `readonly issues: {path?, message}[]`; `origin = '@platform/env'`. **No** está mapeado en `toHttpError` — nunca se espera en tiempo de request.                                                                   | Se captura solo en el arranque del proceso (o en tests de `env.ts`), no en controllers.                                     |
| `StandardSchemaV1`                                                               | Tipo (no runtime), re-exportado desde `@platform/core` por conveniencia — ver [Validación (Standard Schema)](../SKILL.md#validación-standard-schema).                                                                                                                                    | Permite tipar un schema propio o de terceros sin acoplar `env.ts` a la API concreta de ninguna librería.                    |

**Cambiar a zod (o cualquier otro validador Standard Schema) más adelante no requiere tocar
`loadEnv` ni escribir ningún adapter** — el schema de zod ya implementa `~standard`:

```ts
import { loadEnv } from "@platform/env";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const config = loadEnv(schema); // mismo loadEnv, cero cambios fuera de este archivo
```

Para `.env` local (solo `deployment/local`, Lambda ya recibe sus env vars inyectadas por la
plataforma/IaC): Node ≥20.6 trae `process.loadEnvFile()` nativo — no hace falta el paquete `dotenv`
ni un helper propio, se llama una vez antes de `loadEnv` en el bootstrap del server local.
