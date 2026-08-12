---
name: platform
description: |
  Arquitectura hexagonal + DDD para construir aplicaciones sobre los paquetes de este monorepo
  (@platform/core, /infrastructure, /env, /adapter-aws, /adapter-node, /adapter-redis, /testing).
  Este archivo es el índice: filosofía, instalación, y un mapa de qué archivo de references/ leer
  según la pregunta (estructura de carpetas, jerarquía de errores, UseCase/ApplicationResult,
  primitivas HTTP, dominio, eventos, env, testing, composición manual y anti-patrones).

  Usar cuando el usuario: crea una app o servicio nuevo sobre estos paquetes, decide dónde ubicar un
  caso de uso, entidad, repositorio o adaptador, estructura las carpetas de un proyecto backend nuevo,
  pregunta cómo instalar/consumir core, infrastructure o los adapters de este monorepo, o pide revisar
  si un módulo respeta la separación domain/application/infrastructure.
metadata:
  version: 2.1.0
---

# Company Platform — Arquitectura de aplicaciones

Guía para construir aplicaciones sobre los paquetes de este monorepo. No es un framework: es una
convención de carpetas + un conjunto de reglas de dependencia, pensada para que la lógica de negocio
quede desacoplada de cualquier proveedor de infraestructura.

Este archivo es el **índice**: filosofía, instalación y el mapa de qué leer para cada pregunta. El
detalle de cada tema vive en `references/` — cargá solo el archivo que corresponde a la tarea en
curso en vez de todo el contrato de una vez.

## Filosofía

> **Más explícito, menos magia oculta.**

- DDD + Arquitectura Hexagonal, adaptados a la realidad del proyecto — sin abstracciones "por si
  acaso".
- Una interfaz/abstracción solo se crea cuando hay una necesidad concreta: múltiples
  implementaciones, desacoplar infraestructura de negocio, o reducir acoplamiento real. Nunca
  especulativamente. Ver [`references/composicion.md`](./references/composicion.md) § "Cuándo
  SÍ/NO crear una abstracción".
- **Composición sobre herencia.** Nada de reflexión, decoradores o descubrimiento automático de
  componentes (`@Injectable`, escaneo de directorios, etc.). El flujo de ejecución se sigue leyendo
  el código.
- **Composición manual por defecto.** Un contenedor de inyección de dependencias solo se evalúa
  cuando el costo de mantener el cableado manual supera la complejidad que añadiría el contenedor —
  no antes.
- Una estructura predecible reduce el contexto que un asistente de IA necesita para ubicar
  responsabilidades, generar código y proponer refactors con precisión — es también la razón de que
  este Skill esté partido en referencias por tema en vez de un único documento.

## Instalación (sin registro de publicación)

Estos paquetes no se publican a ningún registro todavía. La única vía de instalación es clonar este
repositorio y copiar lo que el proyecto consumidor necesita.

> **En transición.** `.claude/plan-implementacion-rediseno.md` (Fase 0) ya scoping un modelo de
> distribución vía registro privado (`npm install @platform/core`, con changesets para versionado
> semántico por paquete) para reemplazar este flujo de "clonar y copiar" — el registro concreto
> (GitHub Packages vs. AWS CodeArtifact) todavía no está decidido. Hasta que se resuelva, esta
> sección sigue siendo la vía real de instalación.

1. Clona `platform` en una ruta accesible desde tu proyecto.
2. Copia los paquetes que necesites dentro de tu propio repo:
   - `packages/core` — siempre necesario (dominio + aplicación compartidos).
   - `packages/infrastructure` — siempre necesario (HTTP, `RestClient`, `EventBus`, errores).
   - `packages/env` — recomendado para todo proyecto (carga/valida `process.env` para
     `infrastructure/env.ts` — ver [`references/env.md`](./references/env.md)). Sin dependencias
     de terceros por defecto; intercambiable por zod/valibot/arktype sin tocar el resto del
     proyecto.
   - `packages/adapters/aws` — solo si el deployment target es AWS Lambda / API Gateway.
   - `packages/adapters/node` — solo si el deployment target es un servidor HTTP local/Node.
   - `packages/adapters/redis` — solo si el proyecto necesita cachear respuestas HTTP en Redis
     (`RedisHttpResponseCache` — ver [`references/http.md`](./references/http.md)).
   - `packages/testing` — recomendado como `devDependency` — ver
     [`references/testing.md`](./references/testing.md).
3. Referéncialos como dependencias — **coloca las carpetas copiadas bajo tu propio `packages/` y
   usa `"@platform/core": "workspace:*"` (idem para el resto), como un workspace pnpm propio.**
   Es la única vía que hoy resuelve de punta a punta: cada paquete de este repo declara sus propias
   dependencias internas como `workspace:*` (p. ej. `@platform/infrastructure` →
   `@platform/core`), y ese protocolo solo se reescribe a un rango semver real al **publicar** — no
   al copiar. Referenciar un paquete con dependencias internas (todos salvo `core`) vía `file:`
   apuntando _fuera_ de un workspace pnpm falla en el install (`workspace:*` no resuelve) — no lo
   uses hasta que la Fase 0 del plan de rediseño publique a un registro real. `@platform/create-app`
   (ver [`references/composicion.md`](./references/composicion.md)) automatiza exactamente este
   flujo (copiar + `pnpm-workspace.yaml` propio + build en orden de dependencia).
4. Corre `tsc` (`turbo run build` si tu proyecto también usa Turborepo) para generar `dist/` antes
   de consumirlos — cada paquete se resuelve vía su `main`/`exports` apuntando a `dist/index.js`.
   Cada `tsconfig.json` copiado extiende `tsconfig.base.json` con una ruta relativa fija (p. ej.
   `../../tsconfig.base.json`) — copiá también ese archivo a la misma profundidad relativa en tu
   proyecto, o esas rutas no van a resolver.

No vendorees el código fuente editándolo dentro de tu proyecto: si necesitas un cambio en `core` o
`infrastructure`, hazlo en el paquete original y vuelve a copiarlo — mantener un fork silencioso
rompe la trazabilidad de cambios entre proyectos.

Cada paquete versiona su `package.json` (`version`) y mantiene un `CHANGELOG.md` propio cuando su
contrato público cambia (ver `README.md` raíz § Versionado y contribución) — antes de volver a
copiar un paquete, revisa su `CHANGELOG.md` para saber qué cambió desde tu última copia y si hay
algo breaking que actualizar en tu proyecto.

## Validación (Standard Schema)

No es una capa de `src/core/*` del proyecto, sino un export de la propia librería: la interfaz
[Standard Schema](https://standardschema.dev) y un helper para validar contra ella, compartidos por
todo lo demás que valida algo en `@platform/*` (`@platform/env`'s `loadEnv` — ver
[`references/env.md`](./references/env.md) —, los validadores HTTP de `infrastructure` — ver
[`references/http.md`](./references/http.md)).

| Export                                  | Firma real                                                                                                                                                                                        | Uso típico                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StandardSchemaV1`                      | Tipo (no runtime): interfaz de interoperabilidad que implementan zod ≥3.24, valibot, arktype y el builder `env.*` de `@platform/env`.                                                             | Tipar un schema propio o de terceros sin acoplar el código a la API concreta de ninguna librería.                                                    |
| `validateStandardSchema(schema, value)` | `<Schema extends StandardSchemaV1>(schema: Schema, value: unknown) => { success: true, value } \| { success: false, issues: {path?, message}[] }`. Nunca tira — devuelve el resultado como valor. | Base de `loadEnv` (`@platform/env`) y de `parseJsonBody`/`parseQueryParams`/`parsePathParams` (`@platform/infrastructure`); rara vez se usa directo. |

## Qué leer según la pregunta

| Pregunta                                                                                           | Referencia                                                 |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| ¿Qué carpeta le corresponde a esto? ¿Cuál es la dirección de dependencias?                         | [`references/estructura.md`](./references/estructura.md)   |
| ¿Cómo extiendo un error propio? ¿Cómo se serializa un error para logging?                          | [`references/errores.md`](./references/errores.md)         |
| ¿Cómo modelo una entidad, un value object, un agregado?                                            | [`references/dominio.md`](./references/dominio.md)         |
| ¿Cómo escribo un caso de uso? ¿Cómo lo conecto a un endpoint HTTP?                                 | [`references/usecase.md`](./references/usecase.md)         |
| ¿Qué primitivas HTTP existen (router, dispatcher, cache, `RestClient`)? ¿Dónde va un puerto nuevo? | [`references/http.md`](./references/http.md)               |
| ¿Cómo publico/consumo un evento de dominio? ¿Cómo escribo un consumer async (SQS/EventBridge)?     | [`references/eventos.md`](./references/eventos.md)         |
| ¿Cómo leo/valido variables de entorno?                                                             | [`references/env.md`](./references/env.md)                 |
| ¿Qué dobles de test ya existen (`@platform/testing`)?                                              | [`references/testing.md`](./references/testing.md)         |
| ¿Cómo se cablea todo sin contenedor de DI? ¿Cuándo creo una abstracción? ¿Qué anti-patrones evito? | [`references/composicion.md`](./references/composicion.md) |

Para el ejemplo end-to-end completo (servicio de tickets mínimo, HTTP local) ver también el
`README.md` de la raíz del monorepo.
