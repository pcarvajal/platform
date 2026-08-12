# Contribuir a `platform`

## Versionado semántico

Cada paquete de `packages/*` versiona independientemente vía
[changesets](https://github.com/changesets/changesets) — `pnpm changeset` antes de un PR que
cambie el contrato público de un paquete, eligiendo `patch`/`minor`/`major` por paquete afectado
(ver `README.md` § Versionado y contribución para el flujo básico). Esta sección detalla **qué
cuenta como qué** para los dos contratos menos obvios del repo: la jerarquía de errores y el
shape de `ApplicationResult`.

### Qué es breaking en la jerarquía de errores (`@platform/core`, `@platform/infrastructure`)

El `type` de un error (`packages/core/src/platform/StructuredError.ts`) y el mapeo
`type → HttpError` (`HTTP_ERROR_BY_APPLICATION_ERROR_TYPE` en
`packages/infrastructure/src/http/toHttpResponse.ts`, y el equivalente en `toHttpError.ts`) son
**contratos de datos entre servicios**, no solo tipos de TypeScript — si dos servicios construidos
sobre esta plataforma se comunican por HTTP o eventos, el `type` es lo que el consumidor matchea
para decidir cómo reaccionar a un error. `tsc` no detecta una ruptura de este contrato (sigue
compilando perfecto), así que la disciplina es manual:

| Cambio                                                                                                                  | Clasificación        | Por qué                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agregar un error por defecto nuevo (nueva subclase de `ApplicationError`/`DomainError`/`HttpError`)                     | **Aditivo (minor)**  | Nadie dependía de que ese `type` no existiera.                                                                                                                   |
| Agregar un campo nuevo a `data` (una propiedad `readonly` nueva en el constructor de un error existente)                | **Aditivo (minor)**  | Un consumidor que no lee ese campo no se entera.                                                                                                                 |
| Renombrar el `type` de un error existente                                                                               | **Breaking (major)** | Cualquier consumidor que hace `if (error.type === "X")` deja de matchear silenciosamente — no es un error de compilación en el consumidor, es un bug en runtime. |
| Quitar/renombrar una propiedad que ya aparecía en `data`                                                                | **Breaking (major)** | Mismo problema que renombrar `type`, aplicado a un campo de `data`.                                                                                              |
| Cambiar a qué `HttpError`/status code mapea un `type` existente (`HTTP_ERROR_BY_APPLICATION_ERROR_TYPE`, `toHttpError`) | **Breaking (major)** | Un consumidor HTTP que hoy recibe 404 y empieza a recibir 500 (o viceversa) para el mismo error de negocio ve un cambio de comportamiento, no de tipos.          |
| Cambiar la forma de `toScalars()` en sí (`{ type, origin?, description, data }`)                                        | **Breaking (major)** | Es el contrato de serialización que atraviesa todo el repo — cualquier cambio de forma rompe a todo el que lo loguea o lo transporta.                            |

### Qué es breaking en `ApplicationResult`/`UseCase`

`UseCase.execute(command, context?)` (`packages/core/src/application/UseCase.ts`) — el parámetro
`context` es opcional, así que agregarlo fue aditivo (ver `CHANGELOG.md` de `core`). La misma
regla aplica a futuros parámetros nuevos: **agregar un parámetro opcional al final es aditivo;
agregar uno requerido, o cambiar el orden/tipo de uno existente, es breaking** — rompe toda
implementación existente de la interfaz, no solo los call sites.

`Logger#bind` (`packages/core/src/application/Logger.ts`) es un método **concreto** en la clase
base (no abstracto) — agregar métodos concretos nuevos a `Logger` es aditivo por diseño: ninguna
subclase existente necesita implementarlos. Si en el futuro se agrega un método **abstracto**
nuevo a `Logger`, eso sí es breaking (toda subclase existente deja de compilar).

## Antes de abrir un PR

```sh
pnpm build && pnpm lint && pnpm format:check && pnpm test
```

Los cuatro corren en CI (`.github/workflows/ci.yml`) contra cualquier PR a `main`.
