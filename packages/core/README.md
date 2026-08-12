# @platform/core

Paquete base de la plataforma: no depende de ningún otro paquete de este monorepo. Define la
jerarquía de errores compartida por toda la pila, el estándar de respuesta de la capa de
aplicación (`UseCase`/`ApplicationResult`), las primitivas de dominio (DDD) y la interfaz de
validación (Standard Schema) sobre la que se construyen `@platform/env` e
`@platform/infrastructure`.

Referencia completa (firmas exactas, tabla de errores por defecto, ejemplos): ver
[`platform/SKILL.md`](../skills/platform/SKILL.md) § Jerarquía de errores,
§ `core/`.

## Jerarquía de errores

```
                     StructuredError
                ↙                     ↘
       PlatformError              ExtensibleError
 (errores DE @platform/* —        (punto de extensión público —
  nunca extender desde              tus errores van acá)
  código de proyecto)           ↙        ↓         ↘
       ↓                ApplicationError DomainError HttpError
   AdapterError                                    (@platform/infrastructure)
(adapter-aws/node)
```

Todo error (de librería o de proyecto) hereda `toScalars()`, que serializa
`{ type, origin?, description, data }` — `data` refleja automáticamente las propiedades que
declares en el constructor del error (incluido `cause`, si se pasó uno) sin tener que armar el
payload a mano:

```ts
import { ApplicationError } from "@platform/core";

export class OrderAlreadyShippedError extends ApplicationError {
  readonly type = "OrderAlreadyShippedError";
  constructor(orderId: string) {
    super(`Order ${orderId} was already shipped`, { details: { orderId } });
  }
}
```

Extiende `ApplicationError` o `DomainError` para tus propios errores — nunca `PlatformError` (es
exclusiva de estas librerías: `err instanceof PlatformError` significa "esto vino del framework").
`core` ya trae por defecto `ValidationError`, `NotFoundError`, `UpstreamServiceError`,
`UpstreamTimeoutError`, `IntegrationMismatchError`, `UnexpectedError` (application) e
`InvalidArgumentError` (domain), listos para usar sin subclasificar.

## `UseCase` / `ApplicationResult`

```ts
import { toApplicationSuccess, toApplicationFailure, type UseCase } from "@platform/core";

export class CreateOrder implements UseCase<CreateOrderCommand, Order> {
  constructor(private readonly orders: OrderRepository) {}

  async execute(command: CreateOrderCommand) {
    try {
      const order = Order.create(command);
      await this.orders.save(order);
      return toApplicationSuccess(order);
    } catch (err) {
      return toApplicationFailure(err);
    }
  }
}
```

`execute()` nunca lanza un error de negocio esperado — lo captura y lo devuelve como
`ApplicationResult` (`{ ok: true, data } | { ok: false, error }`). `toHttpResponse`
(`@platform/infrastructure`) es la contraparte que traduce ese resultado a la respuesta HTTP
correcta en la capa de `apps/`.

## Primitivas de dominio

`ValueObject<T>`, `EnumValueObject<T>`, `PatternValueObject`, `AggregateRoot<TScalar>`,
`DomainEvent<TAttributes>`, `DomainEventSubscriber<T>`, `Uuid` — building blocks de DDD para
`core/domain/` en un proyecto consumidor. `AggregateRoot.record()`/`pullDomainEvents()` es el
mecanismo estándar para acumular y publicar eventos de dominio (vía el `EventBus` de
`@platform/infrastructure`) después de persistir.

## Validación

`StandardSchemaV1` — el tipo de interoperabilidad de [Standard Schema](https://standardschema.dev)
(compatible con zod, valibot, arktype) y `validateStandardSchema` que lo consumen tanto
`@platform/env` como los parsers HTTP de `@platform/infrastructure`, para no atar el resto de la
librería a un validador concreto.

## Consumo

```ts
import { ApplicationError, toApplicationFailure, ValueObject } from "@platform/core";
```

`"@platform/core": "workspace:*"` (o `file:../platform/packages/core`) — ver
[README raíz](../../README.md) § Instalación para el flujo completo de copiar el paquete a un
proyecto consumidor.
