import { cacheLife, cacheTag } from "next/cache";
import type { BrandSlug } from "./brands";
import { getCommerceClient } from "./commerce";

/**
 * Cached data access. Catalog reads are cached with explicit lifetimes and
 * tagged per brand and per resource, so a catalog-publish webhook can purge
 * exactly what changed (see app/api/revalidate/route.ts).
 */

export async function getCategories(brand: BrandSlug) {
  "use cache";
  cacheLife("hours");
  cacheTag(`catalog:${brand}`, `categories:${brand}`);
  return getCommerceClient().getCategories(brand);
}

export async function getCategory(brand: BrandSlug, slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`catalog:${brand}`, `category:${brand}:${slug}`);
  return getCommerceClient().getCategory(brand, slug);
}

export async function getFeatured(brand: BrandSlug) {
  "use cache";
  cacheLife("hours");
  cacheTag(`catalog:${brand}`, `featured:${brand}`);
  return getCommerceClient().getFeatured(brand);
}

export async function listProducts(brand: BrandSlug) {
  "use cache";
  cacheLife("hours");
  cacheTag(`catalog:${brand}`, `products:${brand}`);
  return getCommerceClient().listProducts(brand);
}

export async function getProductsByCategory(brand: BrandSlug, category: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`catalog:${brand}`, `category:${brand}:${category}`);
  return getCommerceClient().getProductsByCategory(brand, category);
}

export async function getProduct(brand: BrandSlug, id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`catalog:${brand}`, `product:${brand}:${id}`);
  return getCommerceClient().getProduct(brand, id);
}

/** Search results are query-specific and short-lived. */
export async function searchProducts(brand: BrandSlug, query: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`catalog:${brand}`);
  return getCommerceClient().searchProducts(brand, query);
}
