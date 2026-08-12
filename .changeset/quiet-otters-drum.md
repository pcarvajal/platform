---
"@platform/adapter-aws": minor
---

Add `DynamoDbRepository<TId, TEntity>` — a single-table repository base with the same shape
(`save`/`findById`/`findAll`/`delete`) as `@platform/testing`'s `InMemoryRepository`, so a real and
a test repository are interchangeable. Subclasses only need to declare `toItem`/`fromItem`.
