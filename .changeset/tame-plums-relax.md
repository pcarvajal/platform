---
"@platform/core": minor
"@platform/infrastructure": minor
"@platform/adapter-aws": minor
"@platform/adapter-node": minor
"@platform/testing": minor
---

Add async messaging parity for the HTTP axis (`MessageEnvelope`, `MessageRoute`,
`createMessageDispatcher`, `IdempotencyStore`/`withIdempotency` in `@platform/infrastructure`;
`mapSqsEvent`/`createSqsMessageHandler` and `mapEventBridgeEvent`/`createEventBridgeMessageHandler`
in `@platform/adapter-aws`; `InMemoryIdempotencyStore`/`buildMessageEnvelope` in
`@platform/testing`), and end-to-end request correlation (`RequestContext`/`createRequestContext`
and `Logger#bind` in `@platform/core`, `HttpRequest#requestId` generated once by
`createHttpDispatcher` and threaded through `route()`, `RestClientOptions#context` propagated as
`x-request-id`/`traceparent` by `NodeFetchRestClient`).

All additive: `UseCase#execute` gained an optional second `context` parameter (existing
implementations that only declare `execute(command)` remain valid), and `Logger#bind` is a
concrete method on the base class that delegates to the existing abstract methods — no existing
`Logger` subclass needs to change.
