export * from "./src/InMemoryRepository.js";
export * from "./src/FakeLogger.js";
export * from "./src/buildHttpRequest.js";
export * from "./src/InMemoryCache.js";
export * from "./src/FakeRestClient.js";

// El mismo doble de EventBus sirve para desarrollo local y para tests — vive en adapter-node
// (es la implementación "de referencia" a ese nivel, sin dependencias externas) y se reexporta
// acá para que un proyecto no tenga que pensar en qué paquete tiene qué al armar sus tests.
export { InMemoryEventBus } from "@platform/adapter-node";
