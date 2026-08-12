# @platform/env

Paquete para cargar y validar variables de entorno en proyectos construidos sobre `@platform/*`.
Separa dos responsabilidades: obtener los valores crudos (por defecto, `process.env`) y validarlos
contra un schema tipado, lanzando un error estructurado si algo falta o no tiene el formato
esperado. También trae `env.appContext`, el preset con el contexto de aplicación obligatorio de
esta convención (`APP_SERVICE_NAME`/`APP_ENVIRONMENT`/`APP_LOG_LEVEL`).

No depende de ningún validador de terceros. Se apoya en [Standard Schema](https://standardschema.dev),
la interfaz de interoperabilidad que ya implementan zod (≥3.24), valibot y arktype, de modo que
cualquier schema construido con este paquete o con esas librerías funciona con la misma función de
carga sin código adicional.

## Uso en un proyecto

Se usa dentro del único punto donde el proyecto debe leer `process.env`
(`src/infrastructure/env.ts` en la convención de `platform`). `env.appContext(extra?)` es el punto
de entrada esperado ahí — un `env.object` con el contexto de aplicación obligatorio
(`APP_SERVICE_NAME`/`APP_ENVIRONMENT`/`APP_LOG_LEVEL`) ya cargado, extendido con lo que el proyecto
necesite:

```ts
// src/infrastructure/env.ts
import { loadEnv, env } from "@platform/env";

const schema = env.appContext({
  PORT: env.port().default(3000),
  DATABASE_URL: env.url(),
  ALLOWED_ORIGINS: env.array(env.url()),
  FEATURE_X: env.boolean().optional(),
});

// Se llama una sola vez, al importar el módulo, para que el proceso falle al arrancar si el
// entorno está mal configurado, en vez de fallar a mitad de un request.
export const config = loadEnv(schema);
```

`config` queda tipado según el schema (`{ APP_SERVICE_NAME: string; APP_ENVIRONMENT: "development" |
"staging" | "production"; APP_LOG_LEVEL: "debug" | "info" | "warn" | "error" | "silent"; PORT: number;
DATABASE_URL: string; ALLOWED_ORIGINS: string[]; FEATURE_X: boolean | undefined }`), y el resto del proyecto recibe esos
valores ya parseados por inyección de dependencias, sin volver a tocar `process.env`. `extra` se
spreadea antes que las tres keys del contexto, así que no puede pisarlas — solo puede agregar
campos nuevos.

Si el entorno no cumple el schema (incluida la ausencia de alguna de las tres vars obligatorias),
`loadEnv` lanza `EnvValidationError` (extiende `ApplicationError` de `@platform/core`) con el
detalle de cada variable inválida en `issues`.

Además de `object`/`string`/`number`/`boolean`/`enum` (usados arriba y en el ejemplo de zod más
abajo), el builder trae `url()` (valida con `new URL()`), `port()` (entero 1-65535),
`array(itemSchema, { separator? })` (split + valida cada token contra cualquier Standard Schema) y
`json(schema?)` (parsea JSON y opcionalmente valida el resultado) — inventario completo con firmas
exactas en [`references/env.md`](../skills/platform/references/env.md). Si un schema no necesita
el contexto obligatorio (poco común fuera de `infrastructure/env.ts`), `env.object` sigue
disponible directo.

### Cambiar a un validador de terceros

No requiere modificar `loadEnv` ni el resto del proyecto — un schema de zod (o de cualquier
librería que implemente Standard Schema) ya cumple la interfaz esperada:

```ts
import { loadEnv } from "@platform/env";
import { z } from "zod";

const schema = z.object({
  APP_SERVICE_NAME: z.string(),
  APP_ENVIRONMENT: z.enum(["development", "staging", "production"]),
  APP_LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
});

export const config = loadEnv(schema);
```

`env.appContext` es un helper de este paquete, no algo que Standard Schema en sí provea — si
`infrastructure/env.ts` migra por completo a zod/valibot/arktype, las tres keys del contexto
obligatorio se declaran a mano ahí (como arriba), y `@platform/doctor` sigue validando que estén
sin importar qué builder se usó para declararlas.

## Ventajas

- **Sin dependencias de terceros por defecto.** El builder `env.*` cubre los casos comunes
  (string, number, boolean, enum, opcionales, valores por defecto) sin agregar peso al proyecto.
- **Intercambiable sin código adaptador.** Al construirse sobre Standard Schema, migrar a zod,
  valibot o arktype es cambiar el schema, no reescribir la integración.
- **Falla rápido y en el lugar correcto.** La validación es síncrona y pensada para ejecutarse una
  única vez al arrancar el proceso, no en cada request.
- **Errores consistentes con el resto de la librería.** `EnvValidationError` se integra en la
  misma jerarquía de errores (`toScalars()`, `origin`, `cause`) que ya usan `core` e
  `infrastructure`.
- **Contexto de aplicación obligatorio, sin ceremonia extra.** `env.appContext(extra?)` carga
  `APP_SERVICE_NAME`/`APP_ENVIRONMENT`/`APP_LOG_LEVEL` con la misma sintaxis que cualquier otro
  schema, y `@platform/doctor` confirma que cada proyecto lo declara.
- **Testeable.** `loadEnv` acepta una fuente de valores explícita en vez de leer `process.env`
  directamente, lo que permite probar `env.ts` sin mutar variables de entorno globales.
