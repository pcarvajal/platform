# @platform/adapter-redis

## 1.1.0

### Added

- `RedisCache<T>` — implementación genérica de `Cache<T>` (`@platform/infrastructure`), con toda la
  mecánica de Redis (degradar a cache miss si falla o si una entrada está corrupta, TTL opcional,
  prefijo de claves, logging, `serialize`/`deserialize` inyectables).

### Changed

- `RedisHttpResponseCache` pasa a ser un adaptador delgado sobre `RedisCache<SerializedHttpResponse>`
  — no cambia su API pública.

Requiere `@platform/infrastructure >= 1.1.0` (donde se agregó `Cache<T>`) y
`@platform/core >= 2.0.0`.

## 1.0.0

Versión inicial (`RedisHttpResponseCache`).
