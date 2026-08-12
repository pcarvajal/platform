# `core/domain/` — entidades, value objects y agregados

> Referencia de `platform/SKILL.md`. Ver el índice para cuándo leer cada archivo de
> `references/`.

Entidades, agregados, objetos de valor, servicios de dominio y reglas de negocio. Debe permanecer
completamente independiente de cualquier tecnología (sin SDKs, sin drivers, sin `fetch`/`http`
directo).

> **`domain/` es opcional.** Solo se crea cuando la aplicación tiene reglas de negocio, invariantes
> o modelos propios. Una app cuya única responsabilidad es orquestar sistemas externos (p. ej. un
> glue service entre dos APIs) puede vivir enteramente en `application`, sin inventar entidades
> artificiales solo para "seguir la plantilla".

Dependencia interna: `application → domain`. Ejemplo:

```
src/core
├── application
│   └── OrderCreator.ts
└── domain
    └── Order.ts
```

## Inventario de primitivas de dominio (`packages/core/src/domain`)

| Clase                              | Firma real                                                                                                                                                                                                                                                     | Uso típico                                                                                                                                                                                                                                                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ValueObject<T>`                   | `abstract class ValueObject<T extends string\|number\|boolean\|Date>`; `constructor(readonly value: T)` valida que `value` no sea `null`/`undefined` (lanza `InvalidArgumentError` — ver [`errores.md`](./errores.md)); expone `equals(other)` y `toString()`. | Base de cualquier VO simple: `class Email extends ValueObject<string> { constructor(v: string) { super(v); /* tu propia validación */ } }`.                                                                                                                                                                   |
| `EnumValueObject<T>`               | `constructor(value: T, validValues: readonly T[])`; `protected throwErrorForInvalidValue(value: T): void` ya tiene una implementación por defecto (lanza `InvalidArgumentError`) — solo hace falta sobreescribirla si el VO necesita un error más específico.  | VOs de tipo "estado"/"categoría" con un set cerrado de valores válidos (p. ej. `OrderStatus`).                                                                                                                                                                                                                |
| `PatternValueObject`               | `constructor(value: string, patterns: readonly RegExp[], validValues: readonly string[] = [])`; valida por regex o por match exacto contra `validValues`; mismo `throwErrorForInvalidValue` con default, override opcional.                                    | VOs de formato (emails, códigos, IDs con patrón) que no son un enum cerrado.                                                                                                                                                                                                                                  |
| `DateValueObject`                  | `abstract class DateValueObject extends ValueObject<Date>`; agrega `isBefore`, `isAfter`, `isFuture`, `isPast`. No añade validación propia.                                                                                                                    | Fechas de dominio (`DueDate`, `OccurredOn`) donde importa comparar, no solo envolver un `Date`.                                                                                                                                                                                                               |
| `Uuid<T extends string = string>`  | `constructor(value: T)` valida formato **UUID v4 estricto** (el regex exige el nibble de versión `4` y el bit de variante `[89AB]`); `static random()` genera uno con `crypto.randomUUID()`.                                                                   | Identificadores de agregado: `class OrderId extends Uuid {}`. Si el proyecto usa ULID u otro esquema de ID, `Uuid` no sirve de base — hay que extender `ValueObject<string>` directo.                                                                                                                         |
| `AggregateRoot<TScalar = unknown>` | `protected constructor()` (solo instanciable desde una subclase); `record(event: DomainEvent)` acumula eventos; `pullDomainEvents()` los vacía y devuelve una copia; `abstract toScalar(): TScalar`.                                                           | El caso de uso en `application/` hace `entity.record(new SomethingHappened(...))` dentro del método de dominio, y tras persistir llama `entity.pullDomainEvents()` para publicarlos (vía [`EventBus`](./eventos.md)). `class Order extends AggregateRoot<OrderScalars> { toScalar(): OrderScalars { ... } }`. |

Ver [`eventos.md`](./eventos.md) para `DomainEvent`/`DomainEventSubscriber`/`EventBus`, y
[`errores.md`](./errores.md) para `DomainError`/`InvalidArgumentError`/`UnreachableCaseError`/
`assertNever`.
