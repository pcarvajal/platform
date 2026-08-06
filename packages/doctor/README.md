# @platform/doctor

CLI chica (sin dependencias externas, `node:fs`/`node:path`) que confirma que la carpeta `src/` de un
proyecto consumidor respeta la estructura de
[`company-platform/SKILL.md`](../skills/company-platform/SKILL.md) § Estructura de carpetas — el primer
chequeo que cualquier otra herramienta de la plataforma (p. ej. `@platform/eslint-config`) asume como
precondición.

## Uso

```sh
node ./node_modules/@platform/doctor/dist/src/cli.js        # asume "src" en el cwd
node ./node_modules/@platform/doctor/dist/src/cli.js ruta/a/src
```

Si el proyecto expone el `bin` (workspace pnpm/npm que resuelve `@platform/doctor`), también:

```sh
pnpm exec doctor
pnpm exec doctor ruta/a/src
```

Sale con código `0` si la estructura requerida está completa, `1` si falta algo requerido — pensado para
engancharse en CI (§4.7 de `.claude/consumer-validation-strategy.md`) apenas exista pipeline.

## Qué reporta

- **Requerido (falla, exit 1):** `apps/`, `core/`, `core/application/`, `infrastructure/`,
  `infrastructure/env.ts`, `index.ts`.
- **Opcional (informativo, no falla):** `core/domain/`, `infrastructure/deployment/{aws,local}/`,
  `infrastructure/clients/`, `infrastructure/persistence/` y `shared/` — SKILL.md los documenta como
  condicionales a lo que el proyecto realmente necesita (p. ej. `core/domain/` solo si hay reglas de
  negocio propias).
- **Fuera de convención (advertencia):** cualquier entrada en `src/`, `src/core/`, `src/infrastructure/`
  o `src/infrastructure/deployment/` que no esté en la lista anterior.
- **Señal blanda de DI (advertencia):** si `package.json` del proyecto declara `tsyringe`, `inversify`,
  `awilix` o `reflect-metadata` como dependencia, para que el equipo confirme conscientemente que ya
  evaluó el costo de la composición manual (SKILL.md § Anti-patrones).

## Qué NO valida (a propósito)

Dirección de dependencias entre capas, jerarquía de errores y punto único de `process.env` — eso lo
cubre `@platform/eslint-config` (análisis estático de imports/AST, no de filesystem). `doctor` solo
confirma que las carpetas existen donde se espera; si `core/domain` no existe donde toca, no tiene
sentido correr reglas de fronteras sobre una estructura que no está.

## Build

```sh
pnpm --filter @platform/doctor build
```
