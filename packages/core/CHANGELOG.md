# @platform/core

## 2.0.0

### Breaking

- `UpstreamServiceError`, `UpstreamTimeoutError` e `IntegrationMismatchError` cambian su firma de
  `(message?, cause?)` a `(message?, details?, cause?)` — el segundo argumento posicional ya no es
  `cause`. Cualquier call site existente que pasaba una causa como segundo argumento
  (`new UpstreamServiceError(message, err)`) tiene que actualizarse a
  `new UpstreamServiceError(message, details, err)` (o `new UpstreamServiceError(message, undefined, err)`
  si no hay `details` que adjuntar).

### Fixed

- `StructuredError.toScalars()` ya no pierde el `cause` de un error. `Error#cause` nativo se instala
  como propiedad no enumerable, así que `Object.entries(this)` nunca lo veía — ahora se serializa
  explícitamente en `data.cause` (`{ name, message, stack }`, o recursivamente vía `toScalars()` si
  el `cause` es a su vez un `StructuredError`).

### Added

- `ApplicationError`/`DomainError` aceptan un segundo argumento `{ details?, cause? }` (mismo shape
  que `HttpError` de `@platform/infrastructure`) para adjuntar contexto estructurado a un error
  propio sin interpolarlo en `message`.

### Changed

- `StructuredError.type` pasa de `abstract type: string` a `abstract readonly type: string`, y las
  ~25 clases de error del monorepo que lo implementaban sin `readonly` se normalizaron. No rompe
  código consumidor: una subclase puede seguir implementando el miembro abstracto con un campo
  mutable (verificado con `tsc --strict`).

## 1.0.0

Versión inicial.
