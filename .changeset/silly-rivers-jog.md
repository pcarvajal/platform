---
"@platform/doctor": minor
---

Add `doctor generate:usecase|controller|consumer <Nombre> [srcDir]` — generates the default
ergonomic form documented in `references/usecase.md`/`references/eventos.md` (`BaseUseCase`,
`route()`, a `MessageRoute` via `bySource()`) instead of requiring it to be hand-copied from
documentation. Never overwrites an existing file.
