---
"@platform/core": major
"@platform/env": major
"@platform/create-app": patch
---

Restrict `APP_ENVIRONMENT` to a fixed platform-wide enum instead of a free string, so every
consumer project uses the same three environment names.

- `@platform/core`: new `AppEnvironment` type and `APP_ENVIRONMENTS` runtime array
  (`"development" | "staging" | "production"`, `core/platform/AppContext`) — same pattern as
  `LogLevel`/`LOG_LEVELS`. `AppContext.APP_ENVIRONMENT` is now `AppEnvironment` instead of `string`.
- `@platform/env`: `env.appContext(extra?)` validates `APP_ENVIRONMENT` against `APP_ENVIRONMENTS`
  (`env.enum`, same as `APP_LOG_LEVEL` against `LOG_LEVELS`) — `loadEnv` now throws
  `EnvValidationError` for any other value.
- `@platform/create-app`: generated `.env.example` now defaults to `APP_ENVIRONMENT=development`
  instead of `local`.

**Breaking**: any process currently running with `APP_ENVIRONMENT` set to something other than
`development`/`staging`/`production` (e.g. `local`, `qa`, `prod-eu`) fails to boot after upgrading
— `EnvValidationError` at startup instead of an unrestricted string. Update the deployed value of
`APP_ENVIRONMENT` for every environment before upgrading `@platform/core`/`@platform/env`.
