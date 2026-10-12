import "server-only";
import { assertCommerceEnv } from "./config";
import { mockClient } from "./mock";
import { createScapiClient, scapiConfigFromEnv } from "./scapi";
import { createShopifyClient, shopifyConfigFromEnv } from "./shopify";
import type { CommerceClient } from "./types";

export type CommerceSource = "shopify" | "scapi" | "mock";

/** Shopify wins if both backends are configured. A half-configured backend is an error, not a fallback. */
export function commerceSource(env: NodeJS.ProcessEnv = process.env): CommerceSource {
  assertCommerceEnv(env);
  if (shopifyConfigFromEnv(env)) return "shopify";
  return scapiConfigFromEnv(env) ? "scapi" : "mock";
}

export function getCommerceClient(): CommerceClient {
  assertCommerceEnv();
  const shopify = shopifyConfigFromEnv();
  if (shopify) return createShopifyClient(shopify);
  const scapi = scapiConfigFromEnv();
  return scapi ? createScapiClient(scapi) : mockClient;
}

export { CommerceUpstreamError } from "./http";
export type { CommerceClient, Product, Category } from "./types";
