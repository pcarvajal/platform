# @platform/doctor

CLI chica (sin dependencias externas, `node:fs`/`node:path`) que confirma que la carpeta `src/` de un
proyecto consumidor respeta la estructura de
[`platform/SKILL.md`](../skills/platform/SKILL.md) § Estructura de carpetas — el primer
chequeo que cualquier otra herramienta de la plataforma (p. ej. `@platform/eslint-config`) asume como
precondición. También trae `generate:*`, para generar código nuevo que ya sigue la convención en
vez de verificarla después.

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

Sale con código `0` si la estructura requerida está completa, `1` si falta algo requerido o falta
el contexto de aplicación de `env.ts` — pensado para engancharse en el CI del proyecto consumidor.

## Qué reporta

- **Requerido (falla, exit 1):** `apps/`, `core/`, `core/application/`, `infrastructure/`,
  `infrastructure/env.ts`, `index.ts`.
- **Contexto de aplicación (falla, exit 1):** que `infrastructure/env.ts` declare
  `APP_SERVICE_NAME`/`APP_ENVIRONMENT`/`APP_LOG_LEVEL` (directamente, o vía `env.appContext(...)`
  de `@platform/env`) — chequeo de texto sobre el archivo, no de AST, ver
  [`references/env.md`](../skills/platform/references/env.md).
- **Opcional (informativo, no falla):** `core/domain/`, `infrastructure/deployment/{aws,local}/`,
  `infrastructure/clients/`, `infrastructure/persistence/` y `shared/` — SKILL.md los documenta como
  condicionales a lo que el proyecto realmente necesita (p. ej. `core/domain/` solo si hay reglas de
  negocio propias).
- **Fuera de convención (advertencia):** cualquier entrada en `src/`, `src/core/`, `src/infrastructure/`
  o `src/infrastructure/deployment/` que no esté en la lista anterior.
- **Señal blanda de DI (advertencia):** si `package.json` del proyecto declara `tsyringe`, `inversify`,
  `awilix` o `reflect-metadata` como dependencia, para que el equipo confirme conscientemente que ya
  evaluó el costo de la composición manual (SKILL.md § Anti-patrones).

## `doctor generate:*` — generar código nuevo ya correcto por construcción

No solo verifica la convención — también genera las formas por defecto documentadas en
`references/usecase.md`/`references/eventos.md`, para no copiar/adaptar un ejemplo a mano:

```sh
doctor generate:usecase <Nombre> [srcDir]     # core/application/<Nombre>.ts — BaseUseCase
doctor generate:controller <Nombre> [srcDir]  # apps/<nombre>Route.ts — HttpRoute vía route()
doctor generate:consumer <Nombre> [srcDir]    # apps/<nombre>Route.ts — MessageRoute vía bySource()
```

`srcDir` por defecto es `"src"`, igual que el chequeo normal. Ninguno de los tres pisa un archivo
existente — falla en vez de sobreescribir. `generate:controller`/`generate:consumer` esperan que
`<Nombre>` ya exista en `core/application/` (importan su tipo `<Nombre>Command`), así que
`generate:usecase` va primero.

## Qué NO valida (a propósito)

Dirección de dependencias entre capas, jerarquía de errores y punto único de `process.env` — eso lo
cubre `@platform/eslint-config` (análisis estático de imports/AST, no de filesystem). `doctor`
confirma que las carpetas/archivos existen donde se espera, más un chequeo de texto puntual sobre
`env.ts` (el contexto de aplicación, arriba) — nunca AST; si `core/domain` no existe donde toca, no
tiene sentido correr reglas de fronteras sobre una estructura que no está.

## Build

```sh
pnpm --filter @platform/doctor build
```
