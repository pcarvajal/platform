# Jerarquía de errores

> Referencia de `company-platform/SKILL.md`. Ver el índice para cuándo leer cada archivo de
> `references/`.

Todos los errores de `@platform/core` e `/infrastructure` (`packages/core/src/platform`) comparten
una raíz común, `StructuredError extends Error` (`type`, `origin?`, `cause`, `toScalars()`), que se
bifurca en dos ramas con propósitos distintos:

```
                         StructuredError
                    ↙                     ↘
           PlatformError              ExtensibleError
     (errores DE estas               (punto de extensión
      librerías — no                  PÚBLICO — tus errores
      extender desde tu               van acá)
      proyecto)                    ↙        ↓         ↘
           ↓              ApplicationError  DomainError  HttpError
       AdapterError            ↓                ↓           ↓
    (adapter-aws/node,   tus errores de    tus errores    tus errores
     ver adapters)        aplicación        de dominio       HTTP
```

- **`PlatformError`** es exclusiva de estas librerías: la usan internamente para señalar que un
  error vino del propio framework (p. ej. `AdapterError`, extendida por
  `MalformedApiGatewayEventError`, `MalformedHttpRequestError`, `HttpServerListenError`,
  `HttpServerCloseError`, `HttpRequestStreamError` — ver `deployment/aws` y `deployment/local` en
  [`http.md`](./http.md)). **Nunca extiendas `PlatformError` ni `AdapterError` desde el código de tu
  proyecto** — no son tu punto de extensión, y hacerlo rompe la garantía de que
  `err instanceof PlatformError` significa "esto vino de la librería, no de mi app".
- **`ExtensibleError`** es el punto de extensión público. `ApplicationError`, `DomainError` (`core`)
  y `HttpError` (`infrastructure`, ver [`http.md`](./http.md)) ya extienden de aquí — y cada uno
  trae errores por defecto listos para usar (ver tablas más abajo). Cuando el proyecto necesita un
  error propio, siempre se extiende uno de estos tres, nunca `StructuredError` ni `ExtensibleError`
  directamente:

```ts
// core/application/OrderAlreadyShippedError.ts
import { ApplicationError } from "@platform/core";

export class OrderAlreadyShippedError extends ApplicationError {
  readonly type = "OrderAlreadyShippedError";
  constructor(readonly orderId: string) {
    super(`Order ${orderId} was already shipped`);
  }
}
```

Como todos comparten `toScalars()`, cualquier error (de la librería o del proyecto) se serializa
igual para logging: `{ type, origin?, description, data }`, donde `data` refleja automáticamente
las propiedades propias que declares en el constructor (`readonly orderId` del ejemplo de arriba
aparece solo en `data` sin armarlo a mano) **más `cause`, si se pasó uno** (serializado como
`{ name, message, stack }`, o recursivamente vía `toScalars()` si el `cause` es a su vez un
`StructuredError`).

`ApplicationError`/`DomainError` (igual que `HttpError`) aceptan un segundo argumento
`{ details?, cause? }` para adjuntar contexto estructurado sin interpolarlo en `message` —
`UpstreamServiceError`/`UpstreamTimeoutError`/`IntegrationMismatchError` ya lo usan
(`new UpstreamServiceError(message, { statusCode, body }, cause)`):

```ts
export class OrderAlreadyShippedError extends ApplicationError {
  readonly type = "OrderAlreadyShippedError";
  constructor(orderId: string) {
    super(`Order ${orderId} was already shipped`, { details: { orderId } });
  }
}
```

**Cuidado con qué declaras en el constructor de tu propio error.** `toScalars()` refleja por
**nombre** de propiedad (excluye solo `type`/`origin`/`message`), no por modificador de acceso de
TypeScript — `private`/`protected` no existen en el JS compilado, así que una propiedad
`private readonly cardToken: string` en el constructor de un error propio **sí** termina en `data`
igual que una `public`. No pases secretos/tokens/PII como propiedad de un error; si necesitás
preservarlos para debugging interno, filtralos antes de loguear `toScalars()`.

## Inventario de errores de aplicación (`packages/core/src/application`)

`ApplicationError` trae 6 errores por defecto, todos con `origin = '@platform/core'` y un
`cause?: unknown` opcional en el constructor para no perder la traza del error original:

| Clase                      | Firma real                                                                                                                                                                                                                    | Mapeo HTTP (`toHttpError`)                                                                 | Uso típico                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `NotFoundError`            | `constructor(message = 'Not found', cause?)`. Sin código HTTP propio — homónimo del `NotFoundError` de `infrastructure`; alias si se usan ambos: `NotFoundError as CoreNotFoundError`.                                        | `NotFoundError` (404)                                                                      | Un caso de uso busca una entidad y no la encuentra.                                                                      |
| `ValidationError`          | `constructor(message = 'Validation failed', cause?)`.                                                                                                                                                                         | `UnprocessableEntityError` (422)                                                           | Falla una validación de negocio a nivel de caso de uso (para VOs individuales, usar `InvalidArgumentError` de `domain`). |
| `UpstreamTimeoutError`     | `constructor(message = 'Upstream timeout', details?, cause?)`. Ya la lanza `NodeFetchRestClient` cuando expira `AbortSignal.timeout`, con `details: { method, url, timeoutMs }`.                                              | `GatewayTimeoutError` (504)                                                                | Un sistema externo no respondió a tiempo.                                                                                |
| `UpstreamServiceError`     | `constructor(message = 'Upstream error', details?, cause?)`. Ya la lanza `NodeFetchRestClient` en errores de red, respuestas no-2xx (`details: { method, url, statusCode, body }`), y también si un 2xx trae un body no-JSON. | `BadGatewayError` (502)                                                                    | Un sistema externo respondió con error o algo inconsumible.                                                              |
| `IntegrationMismatchError` | `constructor(message = 'Integration mismatch', details?, cause?)`.                                                                                                                                                            | `BadGatewayError` (502)                                                                    | El contrato de un sistema externo cambió de forma inesperada.                                                            |
| `UnexpectedError`          | `constructor(message = 'Unexpected error', cause?)`.                                                                                                                                                                          | Sin mapeo explícito — cae en el fallback `InternalServerError('Unexpected server error')`. | Punto de escape para errores realmente inesperados dentro de un caso de uso.                                             |

Para errores de negocio más específicos del proyecto, extender `ApplicationError` directo (ver
ejemplo arriba) en vez de forzar alguno de estos seis a un caso que no encaja.

## `DomainError` y sus implementaciones concretas (`packages/core/src/domain`)

| Clase                   | Firma real                                                                                                                                                                           | Uso típico                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DomainError`           | `abstract class DomainError extends ExtensibleError` con `abstract readonly type: string`; constructor `(message, { details?, cause? })`; hereda `toScalars()` de `StructuredError`. | Los errores de negocio del proyecto en `core/domain` extienden esta clase directo — declarar las propiedades adicionales como `readonly` en el constructor para que `toScalars()` las recoja solas.    |
| `InvalidArgumentError`  | Implementación concreta de `DomainError` (`type = 'InvalidArgumentError'`), ya usada internamente por `ValueObject`/`Uuid` (ver [`dominio.md`](./dominio.md)).                       | Reutilizable directo para validaciones simples; para errores de negocio más específicos, extender `DomainError` en el propio `domain/` del proyecto.                                                   |
| `UnreachableCaseError`  | Implementación concreta de `DomainError` (`type = 'UnreachableCaseError'`); `constructor(value: never)` — mensaje incluye el valor recibido serializado.                             | Es lo que lanza `assertNever` (fila de abajo) en runtime; no se instancia a mano.                                                                                                                      |
| `assertNever(x: never)` | Lanza `UnreachableCaseError` si se invoca en runtime — algo que TypeScript debería impedir en compilación.                                                                           | Exhaustividad en `switch` sobre uniones discriminadas (VOs de tipo enum, eventos de dominio, etc.) — si se agrega un caso nuevo sin manejarlo, TypeScript marca error en el `default: assertNever(x)`. |

Ver [`http.md`](./http.md) para `HttpError` y sus subclases (`BadRequestError`,
`UnauthorizedError`, etc.) y el mapeo completo `type` → `HttpError`.
