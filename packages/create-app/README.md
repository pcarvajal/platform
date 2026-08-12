# @platform/create-app

CLI chica (sin dependencias externas, `node:fs`/`node:path`) que scaffoldea un proyecto nuevo
siguiendo [`platform/SKILL.md`](../skills/platform/SKILL.md) § Estructura de
carpetas, y _copia_ (no referencia con `file:`) los paquetes `@platform/*` que un servicio HTTP
local mínimo necesita dentro del propio workspace pnpm del proyecto generado.

## Uso

```sh
node ./node_modules/@platform/create-app/dist/src/cli.js <nombre-proyecto> [--platform-path <ruta>]
```

Si el proyecto expone el `bin` (workspace pnpm/npm que resuelve `@platform/create-app`), también:

```sh
pnpm exec create-app <nombre-proyecto>
pnpm exec create-app <nombre-proyecto> --platform-path ../platform
```

`--platform-path` apunta al checkout de `platform` del que vendorizar los paquetes — default
`../platform`, asumiendo que el proyecto generado y este repo son carpetas hermanas. Falla si
`<platform-path>/packages/core` no existe.

## Qué genera

- `packages/{core,env,infrastructure,adapters/node,testing,eslint-config,doctor}` — copia completa
  de esos paquetes desde el checkout de `platform` (sin `dist/`, `node_modules/`, `.turbo/` ni
  `CHANGELOG.md`), más `tsconfig.base.json` en la raíz para que los `tsconfig.json` vendorizados
  seguir resolviendo sus rutas relativas igual que dentro del monorepo original.
- `src/{apps,core/application}/.gitkeep`, `src/infrastructure/env.ts` (esquema `PORT` con
  `@platform/env`) y `src/infrastructure/deployment/local/server.ts` (arranca `startLocalServer` de
  `@platform/adapter-node`) — el esqueleto mínimo de `platform/SKILL.md` § Estructura de
  carpetas, listo para que `@platform/doctor` no reporte nada faltante.
- `src/index.ts` — barrel vacío, sin lógica de arranque (eso vive en
  `infrastructure/deployment/*`).
- `package.json` (con `postinstall` que construye los paquetes vendorizados en orden de
  dependencia, ya que todavía no hay registro desde el que instalarlos ya compilados),
  `pnpm-workspace.yaml`, `tsconfig.json`, `eslint.config.js` (ignora `packages/**` — es código
  vendorizado de `@platform/*`, no código propio del consumidor, así que no debe lintearse con las
  reglas de límites que sí aplican a un consumidor), `.gitignore` y `README.md` con los próximos
  pasos.

`@platform/adapter-aws` queda fuera del set vendorizado por defecto — solo hace falta si el target
de despliegue es AWS Lambda; el `README.md` generado explica cómo copiarlo a mano.

## Qué NO hace (a propósito)

No publica ni referencia los paquetes `@platform/*` vía `file:` apuntando fuera del workspace
generado: ese protocolo se rompe en cuanto el paquete referenciado tiene a su vez una dependencia
`workspace:*` interna (p. ej. `@platform/infrastructure` → `@platform/core`), porque
`workspace:*` solo se reescribe a un rango semver real al publicar — y estos paquetes todavía no se
publican a ningún registro (el registro privado de destino, GitHub Packages vs. AWS CodeArtifact,
todavía no está definido, ver `README.md` § Versionado y contribución). Vendorizar copiando el
código es la única vía de instalación que hoy funciona de punta a punta; cuando el registro esté
resuelto, este comportamiento debería cambiar a instalar los paquetes como cualquier dependencia de
npm en lugar de copiarlos.

## Build

```sh
pnpm --filter @platform/create-app build
```
