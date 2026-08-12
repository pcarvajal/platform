# `infrastructure/env.ts` y `@platform/env`

> Referencia de `platform/SKILL.md`. Ver el índice para cuándo leer cada archivo de
> `references/`.

`infrastructure/env.ts` es el único punto donde se lee `process.env` en todo el proyecto. El resto
del código recibe configuración ya parseada/tipada por inyección manual (parámetros de constructor)
— nunca lee `process.env` directamente fuera de este archivo (`@platform/eslint-config` lo bloquea
vía `no-restricted-syntax`, ver `packages/eslint-config/index.js`).

Para no reinventar el parseo/validación a mano en cada proyecto, este archivo se apoya en
`@platform/env` (`loadEnv` + el builder `env.*`):

```ts
// src/infrastructure/env.ts
import { loadEnv, env } from "@platform/env";

const schema = env.object({
  PORT: env.number().default(3000),
  DATABASE_URL: env.string(),
  LOG_LEVEL: env.enum(["debug", "info", "warn", "error"]).default("info"),
  FEATURE_X: env.boolean().optional(),
});

// loadEnv valida sincrónicamente contra process.env y tira EnvValidationError si algo falta o
// no matchea — se llama una sola vez acá, al importar el módulo, para que el proceso falle al
// arrancar (cold start de Lambda o boot del server local) y no a mitad de un request.
export const config = loadEnv(schema);
```

## Inventario de `@platform/env`

| Export                                                                           | Firma real                                                                                                                                                                                                                                                                               | Uso típico                                                                                                                  |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `loadEnv(schema, source?)`                                                       | `<Schema extends StandardSchemaV1>(schema: Schema, source: Record<string, string \| undefined> = process.env) => StandardSchemaV1.InferOutput<Schema>`. Valida `source` sincrónicamente; tira `EnvValidationError` si `schema` rechaza el valor.                                         | Única llamada real de `env.ts`. `source` es inyectable — útil para testear `env.ts` sin mutar `process.env` global.         |
| `env.object(shape)` / `.string()` / `.number()` / `.boolean()` / `.enum(values)` | Builder propio, sin dependencias de terceros. Cada valor soporta `.optional()` y `.default(value)`.                                                                                                                                                                                      | Uso por defecto cuando el proyecto no necesita validaciones más allá de tipo/presencia/enum.                                |
| `env.url()` / `.port()`                                                          | `url()` valida con `new URL(value)` (lanza issue si no parsea) y devuelve el string tal cual; `port()` valida un entero en el rango 1-65535.                                                                                                                                             | `DATABASE_URL: env.url()`, `PORT: env.port().default(3000)` — mismo builder, sin reinventar la validación en `env.ts`.      |
| `env.array(itemSchema, { separator? })`                                          | `<Schema extends StandardSchemaV1>(itemSchema: Schema, options?: { separator?: string }) => EnvValueSchema<InferOutput<Schema>[]>`. Separa `value` por `separator` (`","` por defecto) y valida cada token contra `itemSchema` — cualquier Standard Schema, no solo los de este builder. | `ALLOWED_ORIGINS: env.array(env.url())` para `"https://a.com,https://b.com"` sin un `.split(",")` a mano fuera de `env.ts`. |
| `env.json(schema?)`                                                              | `(schema?: StandardSchemaV1) => EnvValueSchema<unknown \| InferOutput<Schema>>`. Parsea `value` como JSON (issue si no es JSON válido) y, si se pasa `schema`, valida el resultado contra él.                                                                                            | `FEATURE_FLAGS: env.json(z.object({ betaUi: z.boolean() }))` sin un `JSON.parse` suelto fuera de `env.ts`.                  |
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
