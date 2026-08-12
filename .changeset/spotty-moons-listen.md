---
"@platform/core": minor
"@platform/adapter-node": minor
"@platform/adapter-aws": minor
---

Make `APP_LOG_LEVEL` actually take effect. The application context required by `env.appContext`
(`@platform/env`) declares `APP_LOG_LEVEL`, `@platform/doctor` fails a project whose
`infrastructure/env.ts` omits it, and the docs promise the process won't start with an invalid
value — but no `Logger` in the repo ever applied it: `NodeConsoleLoggerClient` had no notion of
level at all, and `AWSLoggerClient` accepted `logLevel` that callers had to wire by hand.

- `@platform/core`: `Logger` takes an optional `level` as a second constructor parameter and
  exposes `shouldLog(level)` — both additive (an optional trailing parameter and a **concrete**
  method, per `CONTRIBUTING.md` § Logger; a new abstract method would have broken every existing
  subclass). Without a level, `shouldLog` returns `true`, so any existing `Logger` subclass and any
  existing `new NodeConsoleLoggerClient()` behave exactly as before. `bind()` deliberately does not
  filter: the delegate owns the threshold.
- `@platform/adapter-node`: `NodeConsoleLoggerClient` consults `shouldLog` in each of
  `info`/`error`/`warn`/`debug`, takes an optional `level` as its second constructor parameter, and
  gains `NodeConsoleLoggerClient.fromAppContext(context, { sensitiveKeys? })`.
- `@platform/adapter-aws`: `AWSLoggerClient.fromAppContext(context, { sensitiveKeys? })` maps
  `APP_SERVICE_NAME`/`APP_LOG_LEVEL` onto the powertools logger. Filtering stays with powertools
  (not `shouldLog`), so its `POWERTOOLS_LOG_LEVEL` override keeps working.
