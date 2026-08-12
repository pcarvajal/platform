# @platform/adapter-redis

Implementación en Redis de `HttpResponseCache` (`@platform/infrastructure`), pensada para usarse
junto con `withHttpCache` como cache de lectura (read-through) de respuestas HTTP.

Es una optimización de performance, no una fuente de verdad: si Redis falla o una entrada quedó
corrupta, `RedisHttpResponseCache` degrada a cache miss (dejando pasar el request al handler real)
en vez de propagar el error. Cada fallo se loguea a través del `logger` opcional que se le pase.

## Uso en un proyecto

Vive en `infrastructure/` (es tecnología concreta) y se cablea en el composition root
(`infrastructure/deployment/*`) junto con el resto de los adaptadores:

```ts
// infrastructure/deployment/local/server.ts
import Redis from "ioredis";
import { NodeConsoleLoggerClient } from "@platform/adapter-node";
import { RedisHttpResponseCache } from "@platform/adapter-redis";
import { withHttpCache, type HttpRoute } from "@platform/infrastructure";
import { config } from "../../env.js";

const logger = new NodeConsoleLoggerClient();
const redis = new Redis(config.REDIS_URL);
const cache = new RedisHttpResponseCache(redis, { keyPrefix: "my-service:", logger });

// productsController: el UseCase/controller de turno, wireado como cualquier otro (ver usecase.md).
const routes: HttpRoute[] = [
  {
    method: "GET",
    path: "/products/:id",
    handle: withHttpCache((req) => productsController.handle(req), cache, { ttlSeconds: 60 }),
  },
];
```

`config.REDIS_URL` sale de `infrastructure/env.ts` — extendiendo el contexto de aplicación
obligatorio (`env.appContext`, ver [`references/env.md`](../../skills/platform/references/env.md)):
`env.appContext({ REDIS_URL: env.url() })`.

`RedisHttpResponseCache` recibe el cliente de [ioredis](https://github.com/redis/ioredis) ya
conectado (no lo crea ni lo administra) y un segundo argumento opcional:

- `keyPrefix` — prefijo para todas las claves que escribe/lee (por defecto `"http-cache:"`), útil
  para compartir una misma instancia de Redis entre varios servicios sin colisionar.
- `logger` — cualquier implementación de `Logger` (`@platform/core`). Si no se pasa, los fallos de
  Redis se silencian.

El resto del código (`apps/`, `core/`) no sabe que la cache es Redis — solo conoce la interfaz
`HttpResponseCache` de `infrastructure`, así que cambiar de proveedor de cache es cambiar el
adaptador que se inyecta en el composition root.

## Ventajas

- **Degrada, no falla.** Un outage de Redis o una entrada malformada nunca tumba un request; en el
  peor caso, se pierde el hit de cache y el handler real responde igual.
- **Serialización propia, sin acoplar el formato de Redis al resto del código.** `HttpResponse` se
  serializa/deserializa internamente (`statusCode`, `headers`, `body`); nada fuera de este paquete
  necesita saber que se guarda como JSON.
- **Compatible con `withHttpCache` sin código adicional.** Implementa exactamente la interfaz
  `HttpResponseCache` que espera `infrastructure`, así que se usa como cualquier otra cache de la
  librería.
- **No administra la conexión.** Recibe un cliente `Redis` ya construido, así que el proyecto
  controla el ciclo de vida (conexión, reconexión, cierre) desde su propio composition root.

## `RedisCache<T>` — cache genérica

`RedisHttpResponseCache` es un adaptador delgado sobre `RedisCache<T>`: toda la mecánica de Redis
(degradar a cache miss si falla o si una entrada quedó corrupta, TTL opcional, prefijo de claves,
logging) vive una sola vez en `RedisCache` y es independiente de HTTP.

`RedisCache<T>` implementa `Cache<T>`, la interfaz genérica de `@platform/infrastructure` (mismo
patrón que `RestClient`/`EventBus`: el contrato tecnología-agnóstico vive en `infrastructure`, la
implementación concreta en el adapter). Si necesitás cachear otra cosa (el resultado de un
`UseCase`, un objeto de dominio, un token, etc.), usá `RedisCache<T>` directamente en vez de
reimplementar esa lógica:

```ts
import Redis from "ioredis";
import { NodeConsoleLoggerClient } from "@platform/adapter-node";
import { RedisCache } from "@platform/adapter-redis";
import type { Cache } from "@platform/infrastructure";
import { config } from "../../env.js";

type Product = { id: string; name: string; price: number };

const logger = new NodeConsoleLoggerClient();
const redis = new Redis(config.REDIS_URL);
const productCache: Cache<Product> = new RedisCache<Product>(redis, {
  keyPrefix: "products:",
  logger,
});

await productCache.set(productId, product, 60);
const cached = await productCache.get(productId);
```

Por defecto serializa/deserializa con `JSON.stringify`/`JSON.parse`; si necesitás otro formato,
pasá `serialize`/`deserialize` en las opciones.

## Consumo

`"@platform/adapter-redis": "workspace:*"` (o `file:../../platform/packages/adapters/redis`) — ver
[README raíz](../../../README.md) § Instalación. Solo si el proyecto necesita cachear respuestas
HTTP (u otro valor) en Redis.

Junto con `@platform/adapter-aws`, es de los pocos paquetes de la plataforma con una dependencia de
terceros en runtime, por diseño — ver `CLAUDE.md` § Conventions: [`ioredis`](https://github.com/redis/ioredis)
(el cliente lo instancia y administra el proyecto consumidor, este paquete solo lo recibe ya
conectado), además de `@platform/core`/`@platform/infrastructure`. `@types/node` es `devDependency`.
