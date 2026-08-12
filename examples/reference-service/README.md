# example-reference-service

Servicio de referencia ejecutable, combinando los dos ejes de `platform/SKILL.md` en un
solo proyecto real (no solo snippets de documentación):

- **Eje HTTP (síncrono):** `POST /orders` — `CreateOrder` (`BaseUseCase`) vía `route()`, publica un
  `OrderCreated` (domain event) a través de `InMemoryEventBus`, consumido por
  `OrderCreatedListener`.
- **Eje mensajería (asíncrono):** `ProcessOrderPaid` (`BaseUseCase`) vía un `MessageRoute` +
  `withIdempotency` — `demoConsumer.ts` simula una redelivery _at-least-once_ del mismo mensaje y
  demuestra que la segunda entrega no vuelve a ejecutar `handle`.

No incluye una demo del patrón Outbox (`references/eventos.md`) — necesita persistencia
transaccional real (DynamoDB/Postgres), fuera del alcance de un ejemplo in-memory ejecutable sin
infraestructura.

## Correr

```sh
pnpm install
pnpm run doctor         # confirma que src/ sigue la convención de SKILL.md
pnpm run dev             # POST http://localhost:3000/orders { "customerId": "...", "items": ["..."] }
pnpm run demo:consumer   # simula la entrega (y redelivery) de un evento async
```
