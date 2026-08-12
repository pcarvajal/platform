---
"@platform/core": minor
"@platform/env": minor
"@platform/doctor": patch
"@platform/create-app": patch
---

Add a mandatory application context (`APP_SERVICE_NAME`, `APP_ENVIRONMENT`, `APP_LOG_LEVEL`),
extensible per project:

- `@platform/core`: `AppContext` type (`core/platform`) and `LOG_LEVELS` (runtime array
  counterpart of the existing `LogLevel` union, `core/application/Logger`).
- `@platform/env`: `env.appContext(extra?)` — a preset over `env.object` with the three keys
  pre-loaded; `extra` is spread before them, so it can add project-specific vars but never shadow
  the three mandatory ones. `loadEnv(env.appContext(...))` throws `EnvValidationError` (existing
  behavior) if any of them is missing or `APP_LOG_LEVEL` isn't a valid `LogLevel` — the process
  fails at boot instead of at request time.
- `@platform/doctor`: new check — `infrastructure/env.ts` must reference the three keys (directly,
  or via `env.appContext(...)`), reported as a required failure (`missingAppContextKeys`) with a
  non-zero exit code, same severity as a missing folder.
- `@platform/create-app`: generated `env.ts` now uses `env.appContext`; scaffold also generates a
  tracked `.env.example` and switches `dev` to `node --env-file-if-exists=.env`, since the three
  vars no longer have defaults. Vendored packages also stop copying `*.test.ts` files (pre-existing
  issue, unrelated to this context: those files import `vitest`, which the generated project never
  depends on, so `tsc` failed on `postinstall` as soon as any vendored package had a co-located
  test).

All additive on the type level: `AppContext`/`LOG_LEVELS`/`env.appContext` are new exports, nothing
existing changes shape. `env.object` remains available unchanged for schemas that don't need the
mandatory context.
