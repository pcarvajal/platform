# @platform/adapter-node

## 1.1.0

### Added

- `NodeFetchRestClient` ahora adjunta contexto estructurado (`{ method, url, statusCode, body }`)
  como `details` de `UpstreamServiceError`/`UpstreamTimeoutError` en vez de interpolarlo solo en
  `message` — sobrevive a `ApplicationResult.error.data` y al `details` de la respuesta HTTP final
  (`toHttpResponse`).

### Fixed

- `HttpServerListenError` declara `port` como `public readonly`, así que ya no desaparece de
  `toScalars().data` (antes solo sobrevivía interpolado en `description`).

Requiere `@platform/core >= 2.0.0` (ver su CHANGELOG — cambia la firma de
`UpstreamServiceError`/`UpstreamTimeoutError`, ya actualizado en este paquete).

## 1.0.0

Versión inicial.
