---
"@platform/core": minor
"@platform/infrastructure": minor
---

Add `BaseUseCase` and `matchApplicationResult` (`@platform/core`), and `route()`
(`@platform/infrastructure`) as the default ergonomic forms for a use case and a single-use-case
HTTP endpoint. Purely additive — `UseCase` and controller-classes keep working unchanged as the
manual escape hatch for cases that need more than "run and capture".
