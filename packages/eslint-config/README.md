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
  partida que `eslint.config.base.js` de este repo).
- **`boundaries/element-types`** (`eslint-plugin-boundaries`): mapea `src/core/domain`,
  `src/core/application`, `src/infrastructure`, `src/apps` y `src/shared` a los tipos de elemento de
  `SKILL.md` § Estructura de carpetas, y prohíbe cualquier import que rompa
  `deployment → apps → application → domain` (p. ej. `core/domain` importando de `core/application`, o
  `core/application` importando de `infrastructure`).
- **Prohibición de extender `PlatformError`/`AdapterError`** fuera de `@platform/*` — mapea a
  `SKILL.md` § Jerarquía de errores. Los errores propios del proyecto deben extender
  `ApplicationError`, `DomainError` o `HttpError`.
- **Prohibición de leer `process.env`** fuera de `infrastructure/env.ts` — mapea a
  `SKILL.md` § `infrastructure/env.ts`. Un bloque de excepción habilita la lectura solo en ese archivo.

## Qué NO incluye (a propósito)

No bloquea la introducción de un contenedor de DI (`tsyringe`, `inversify`, `awilix`) — es un juicio de
ingeniería, no un invariante verificable (ver `SKILL.md` § Anti-patrones y `.claude/di-strategy.md §9`).
Para una señal blanda (no bloqueante) sobre esto, ver `@platform/doctor`.

## Requisitos

Asume la convención de carpetas `src/{apps,core/{domain,application},infrastructure,shared}` de
`SKILL.md` § Estructura de carpetas. Un proyecto que aún no sigue esa estructura puede correr
`@platform/doctor` primero para confirmarla.
