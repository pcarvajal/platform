# @platform/infrastructure

## 1.1.0

### Added

- `Cache<T>` — puerto genérico de cache (`get`/`set`/`ttlSeconds`), implementado por
  `RedisCache<T>` (`@platform/adapter-redis`). `HttpResponseCache` sigue siendo la variante
  especializada para `HttpResponse`.

### Changed

- Reorganización interna de `src/`: los puertos sin estado HTTP (`RestClient`, `EventBus`,
  `Cache`, `ApiResponse`) se movieron a `src/ports/`, y `src/http/` ganó su propio barrel
  (`src/http/index.ts`), replicando el patrón de sub-carpeta + barrel que ya usa
  `@platform/core`. No cambia ningún export público — `import { Cache, RestClient, ... } from
"@platform/infrastructure"` sigue funcionando igual.

Requiere `@platform/core >= 2.0.0` (ver su CHANGELOG).

## 1.0.0

Versión inicial.
