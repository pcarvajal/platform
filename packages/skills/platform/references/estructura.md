# Estructura de carpetas y dirección de dependencias

> Referencia de `platform/SKILL.md`. Ver el índice para cuándo leer cada archivo de
> `references/`.

## Árbol de carpetas

```
src
├── apps
├── core
│   ├── application
│   └── domain
├── infrastructure
│   ├── deployment
│   │   ├── aws
│   │   └── local
│   ├── clients
│   ├── persistence
│   └── env.ts
├── shared
└── index.ts
```

## Dirección de dependencias

```
deployment
      ↓
apps
      ↓
application
      ↓
domain
```

La infraestructura **nunca** contiene reglas de negocio. Las flechas solo van hacia el núcleo:
`domain` no importa nada de `application`, `application` no importa nada de
`infrastructure`/`apps`, etc. Es lo que `@platform/eslint-config`
(`eslint-plugin-boundaries`, `ELEMENT_TYPES` en `packages/eslint-config/index.js`) bloquea en
tiempo de lint y `@platform/doctor` verifica en el filesystem.

## Qué va en cada carpeta

- **`apps/`** — puntos de entrada propios de la aplicación (HTTP, evento, comando, proceso
  programado). Adaptan una interacción externa a un caso de uso del dominio. Sin reglas de negocio
  ni SDKs de infraestructura. Ver [`usecase.md`](./usecase.md) para el patrón completo
  (`route()`/controller) y [`http.md`](./http.md) para las primitivas que usa.
- **`core/application/`** — orquesta los casos de uso (`UseCase`/`BaseUseCase` +
  `ApplicationResult`). Sin reglas de negocio — eso es `domain`. Ver [`usecase.md`](./usecase.md).
- **`core/domain/`** _(opcional)_ — entidades, value objects, reglas de negocio, eventos de
  dominio. Solo existe si el proyecto tiene lógica de negocio propia que modelar. Ver
  [`dominio.md`](./dominio.md) (entidades/VOs) y [`eventos.md`](./eventos.md) (eventos de dominio).
- **`infrastructure/deployment/{aws,local}/`** _(opcional, según el target)_ — adaptadores que
  arrancan la aplicación en un entorno concreto (Lambda, servidor HTTP local). Ver
  [`http.md`](./http.md).
- **`infrastructure/clients/`** _(opcional)_ — clientes hacia sistemas externos (REST, GraphQL,
  gRPC, SFTP, brokers de eventos). Ejemplo: `clients/rest/SendEmailRestClient.ts` implementando el
  `RestClient` de `@platform/infrastructure`.
- **`infrastructure/persistence/`** _(opcional)_ — implementaciones de los repositorios que define
  `domain`/`application` (DynamoDB, PostgreSQL, MongoDB, Redis, etc.). Implementación de
  referencia para DynamoDB: `DynamoDbRepository<TId, TEntity>` (`@platform/adapter-aws`) — misma
  forma (`save`/`findById`/`findAll`/`delete`) que `InMemoryRepository` (`@platform/testing`), solo
  hace falta declarar `toItem`/`fromItem` en la subclase. Ejemplo:
  `persistence/DynamoDbOrderRepository.ts`.
- **`infrastructure/env.ts`** — único punto donde se lee `process.env` en todo el proyecto. Declara
  el contexto de aplicación obligatorio (`APP_SERVICE_NAME`/`APP_ENVIRONMENT`/`APP_LOG_LEVEL`, vía
  `env.appContext`) — `@platform/doctor` lo valida igual que el resto de esta estructura. Ver
  [`env.md`](./env.md).
- **`shared/`** _(opcional)_ — componentes reutilizables **exclusivos de esta aplicación**, no un
  cajón de utilidades genéricas. Todo lo que termine siendo útil entre varias aplicaciones debe
  migrar a `@platform/*` (core o infrastructure), no quedarse duplicado en `shared`.

  ```
  src/shared
  └── MyProjectExclusiveHelper.ts
  ```

- **`index.ts`** — barrel de exports públicos de la aplicación (tipos/símbolos que otro servicio
  podría importar). No contiene lógica de arranque — el bootstrap de cada entorno vive en su
  adaptador de `infrastructure/deployment/*`.

## Decisión rápida: "¿dónde va esto?"

```
¿Qué estás escribiendo?
├─ Entra por HTTP/evento/cron y llama a un caso de uso → apps/
├─ Orquesta un caso de uso (sin reglas de negocio) → core/application/
├─ Entidad, value object, regla de negocio, evento de dominio → core/domain/
├─ Arranca el proceso (Lambda handler, servidor HTTP, cron) → infrastructure/deployment/{aws,local}/
├─ Habla con un sistema externo (API, broker) → infrastructure/clients/
├─ Implementa un repositorio (DynamoDB, Postgres...) → infrastructure/persistence/
├─ Lee variables de entorno → infrastructure/env.ts (solo aquí)
├─ Es un error de negocio/HTTP propio del proyecto → extiende ApplicationError/DomainError/HttpError
└─ Reutilizable solo en este proyecto, no genérico → shared/
```
