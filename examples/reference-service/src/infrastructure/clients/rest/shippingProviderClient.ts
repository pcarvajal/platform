import { NodeFetchRestClient } from "@platform/adapter-node";
import type { RestClient } from "@platform/infrastructure";

export type ShippingProviderClientConfig = {
  baseURL: string;
  timeoutMs?: number;
};

// Wrapper con nombre sobre NodeFetchRestClient, scopeado a un sistema externo puntual (ver
// references/estructura.md § infrastructure/clients/, ejemplo SendEmailRestClient). El tipo
// devuelto sigue siendo el puerto RestClient de @platform/infrastructure, no esta función ni
// NodeFetchRestClient — ShipOrder (core/application) depende del puerto sin saber qué hay adentro.
export function createShippingProviderClient(config: ShippingProviderClientConfig): RestClient {
  return new NodeFetchRestClient({
    baseURL: config.baseURL,
    defaultTimeoutMs: config.timeoutMs ?? 5000,
  });
}
