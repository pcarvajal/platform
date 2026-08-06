# @platform/env

Paquete para cargar y validar variables de entorno en proyectos construidos sobre `@platform/*`.
Separa dos responsabilidades: obtener los valores crudos (por defecto, `process.env`) y validarlos
contra un schema tipado, lanzando un error estructurado si algo falta o no tiene el formato
esperado.

No depende de ningún validador de terceros. Se apoya en [Standard Schema](https://standardschema.dev),
la interfaz de interoperabilidad que ya implementan zod (≥3.24), valibot y arktype, de modo que
cualquier schema construido con este paquete o con esas librerías funciona con la misma función de
carga sin código adicional.

## Uso en un proyecto

Se usa dentro del único punto donde el proyecto debe leer `process.env`
(`src/infrastructure/env.ts` en la convención de `company-platform`):

```ts
// src/infrastructure/env.ts
import { loadEnv, env } from "@platform/env";

const schema = env.object({
  PORT: env.number().default(3000),
  DATABASE_URL: env.string(),
  LOG_LEVEL: env.enum(["debug", "info", "warn", "error"]).default("info"),
  FEATURE_X: env.boolean().optional(),
});

// Se llama una sola vez, al importar el módulo, para que el proceso falle al arrancar si el
// entorno está mal configurado, en vez de fallar a mitad de un request.
export const config = loadEnv(schema);
```

`config` queda tipado según el schema (`{ PORT: number; DATABASE_URL: string; LOG_LEVEL: "debug" |
"info" | "warn" | "error"; FEATURE_X: boolean | undefined }`), y el resto del proyecto recibe esos
valores ya parseados por inyección de dependencias, sin volver a tocar `process.env`.

Si el entorno no cumple el schema, `loadEnv` lanza `EnvValidationError` (extiende
`ApplicationError` de `@platform/core`) con el detalle de cada variable inválida en `issues`.

### Cambiar a un validador de terceros

No requiere modificar `loadEnv` ni el resto del proyecto — un schema de zod (o de cualquier
librería que implemente Standard Schema) ya cumple la interfaz esperada:

```ts
import { loadEnv } from "@platform/env";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const config = loadEnv(schema);
```

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
- **Testeable.** `loadEnv` acepta una fuente de valores explícita en vez de leer `process.env`
  directamente, lo que permite probar `env.ts` sin mutar variables de entorno globales.
