---
"@platform/core": patch
---

Fix `toApplicationFailure` losing the original `type`/`data` of any `DomainError` or `HttpError`
thrown inside a use case — it only recognized `ApplicationError` and silently flattened everything
else (including `InvalidArgumentError` and other domain errors) to `UnexpectedError`, contradicting
the documented contract ("any `ApplicationError`, or subclass of `DomainError`/`HttpError`, reuses
its `toScalars()`") and mapping what should be a 400 to a 500 through `toHttpResponse`. Now checks
`instanceof ExtensibleError`, matching all three public extension points.
