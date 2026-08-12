# @platform/eslint-config

Config de ESLint compartida que convierte en regla mecánica lo que
[`platform/SKILL.md`](../skills/platform/SKILL.md) hoy solo describe en prosa: dirección
de dependencias entre capas, jerarquía de errores y el punto único de lectura de `process.env`.

## Uso en un proyecto consumidor

```js
// eslint.config.js
import platformConfig from "@platform/eslint-config";

export default [...platformConfig];
```

Si el proyecto necesita reglas adicionales por paquete, se extiende igual que cualquier config flat:

```js
import platformConfig from "@platform/eslint-config";

export default [
  ...platformConfig,
  {
    files: ["src/infrastructure/**"],
    rules: {
      "no-console": "off",
    },
  },
];
```

## Qué incluye

- `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-config-prettier` (mismo punto de
  partida que `eslint.config.base.js` de este repo), con `globals.node` y `**/dist/**`, `**/.turbo/**`,
  `**/node_modules/**`, `**/coverage/**` ignorados.
- `"no-console": "warn"`, `"@typescript-eslint/no-explicit-any": "warn"` (avisan, no bloquean el
  build — CLAUDE.md § Conventions) y `"@typescript-eslint/no-unused-vars": "error"`, con
  `argsIgnorePattern`/`varsIgnorePattern: "^_"` como escape hatch explícito (un parámetro/variable
  sin usar con prefijo `_` no rompe el lint).
- **`boundaries/element-types`** (`eslint-plugin-boundaries`): mapea `src/core/domain`,
  `src/core/application`, `src/infrastructure`, `src/apps` y `src/shared` a los tipos de elemento de
  `SKILL.md` § Estructura de carpetas, con `settings["import/resolver"].typescript = true` (necesario
  porque `SKILL.md` usa imports relativos con sufijo `.js`, NodeNext, que apuntan a fuentes `.ts` — el
  resolver por defecto del plugin no reescribe esa extensión). Reglas de import permitido por tipo:

  | `from`           | puede importar de (`allow`)                                 |
  | ---------------- | ----------------------------------------------------------- |
  | `domain`         | nada — no depende de `application`/`infrastructure`/`apps`  |
  | `application`    | `domain`                                                    |
  | `apps`           | `application`, `domain`, `shared`                           |
  | `infrastructure` | `apps`, `application`, `domain`, `shared`, `infrastructure` |
  | `shared`         | nada                                                        |

  `infrastructure` puede importar `apps` porque `infrastructure/deployment/*` (el composition root)
  ensambla las rutas/handlers que `apps/` expone — no es una excepción a la dirección de
  dependencias, es la propia dirección (`deployment → apps`).

- **Prohibición de extender `PlatformError`/`AdapterError`** fuera de `@platform/*` — mapea a
  `SKILL.md` § Jerarquía de errores. Los errores propios del proyecto deben extender
  `ApplicationError`, `DomainError` o `HttpError`.
- **Prohibición de leer `process.env`** fuera de `infrastructure/env.ts` — mapea a
  `SKILL.md` § `infrastructure/env.ts`. Un bloque de excepción habilita la lectura solo en ese archivo.

## Qué NO incluye (a propósito)

No bloquea la introducción de un contenedor de DI (`tsyringe`, `inversify`, `awilix`) — es un juicio de
ingeniería, no un invariante verificable (ver `SKILL.md` § Anti-patrones). Para una señal blanda
(no bloqueante) sobre esto, ver `@platform/doctor`.

## Requisitos

- `eslint` `^9.0.0 || ^10.0.0` instalado por el proyecto consumidor — es `peerDependency`, no
  `dependency`, de este paquete (así que no queda vendorizado con una versión propia). El resto
  (`@eslint/js`, `typescript-eslint`, `eslint-plugin-boundaries`, `eslint-import-resolver-typescript`,
  `eslint-config-prettier`, `globals`) sí son dependencias de este paquete — no hace falta
  instalarlas aparte.
- Asume la convención de carpetas `src/{apps,core/{domain,application},infrastructure,shared}` de
  `SKILL.md` § Estructura de carpetas. Un proyecto que aún no sigue esa estructura puede correr
  `@platform/doctor` primero para confirmarla.
