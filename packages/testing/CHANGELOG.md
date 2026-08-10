# @platform/testing

## 1.1.0

### Added

- `InMemoryCache<T>` — doble `Map`-backed de `Cache<T>` (`@platform/infrastructure`).
- `FakeRestClient` — doble de `RestClient` (`@platform/infrastructure`): registra llamadas
  (`.calls`) y las resuelve contra una cola de respuestas programadas
  (`respondWith`/`respondWithError`).

Requiere `@platform/infrastructure >= 1.1.0` y `@platform/core >= 2.0.0`.

## 1.0.0

Versión inicial (`InMemoryRepository`, `FakeLogger`, `buildHttpRequest`, reexporta
`InMemoryEventBus`).
