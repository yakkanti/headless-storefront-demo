import "server-only";
import type { BrandSlug } from "../brands";
import { CommerceUpstreamError, commerceFetch } from "./http";
import type { Category, CommerceClient, Product } from "./types";

/**
 * Shopify Storefront API (GraphQL) client. Collections map to categories and
 * the product handle is the product ID, so URLs stay readable and stable.
 *
 * Brand scoping: one Shopify store backs all three demo brands, so every brand
 * sees the same catalog. A real multi-brand setup would use one store per brand
 * or filter on a brand tag.
 */

export type ShopifyConfig = {
  storeDomain: string; // e.g. my-store.myshopify.com
  token: string; // Storefront API token from the Headless channel
  apiVersion: string;
};

const DEFAULT_API_VERSION = "2026-07";

export function shopifyConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ShopifyConfig | null {
  const { SHOPIFY_STORE_DOMAIN, SHOPIFY_STOREFRONT_TOKEN, SHOPIFY_API_VERSION } = env;
  if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_STOREFRONT_TOKEN) return null;
  return {
    storeDomain: SHOPIFY_STORE_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, ""),
    token: SHOPIFY_STOREFRONT_TOKEN,
    apiVersion: SHOPIFY_API_VERSION || DEFAULT_API_VERSION,
  };
}

/** Private tokens (server-side only) and public tokens are sent in different headers. */
export function authHeader(token: string): Record<string, string> {
  return token.startsWith("shpat_")
    ? { "Shopify-Storefront-Private-Token": token }
    : { "X-Shopify-Storefront-Access-Token": token };
}

type Money = { amount: string; currencyCode: string };

type StorefrontProduct = {
  handle: string;
  title?: string;
  description?: string;
  availableForSale?: boolean;
  productType?: string;
  priceRange?: { minVariantPrice?: Money; maxVariantPrice?: Money };
  compareAtPriceRange?: { minVariantPrice?: Money };
  collections?: { nodes?: { handle: string }[] };
  featuredImage?: { url: string; altText?: string | null } | null;
};

type StorefrontCollection = { handle: string; title?: string; description?: string };

const PRODUCT_FIELDS = `
  fragment ProductFields on Product {
    handle
    title
    description
    availableForSale
    productType
    priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount } }
    compareAtPriceRange { minVariantPrice { amount currencyCode } }
    collections(first: 1) { nodes { handle } }
    featuredImage { url altText }
  }
`;

/** Catch-all category, so products that are in no collection still have a listing page. */
export const ALL_CATEGORY: Category = { slug: "all", name: "All products", description: "Everything in the store." };

export function mapProduct(brand: BrandSlug, p: StorefrontProduct, category?: string): Product {
  const price = Number(p.priceRange?.minVariantPrice?.amount ?? 0);
  const priceMax = Number(p.priceRange?.maxVariantPrice?.amount ?? 0);
  const compareAt = Number(p.compareAtPriceRange?.minVariantPrice?.amount ?? 0);
  const name = p.title ?? p.handle;
  return {
    id: p.handle,
    brand,
    category: category ?? p.collections?.nodes?.[0]?.handle ?? ALL_CATEGORY.slug,
    name,
    price,
    priceMax: priceMax > price ? priceMax : undefined,
    currency: p.priceRange?.minVariantPrice?.currencyCode ?? "USD",
    description: p.description ?? "",
    badge: compareAt > price ? "Sale" : undefined,
    inStock: p.availableForSale ?? true,
    image: p.featuredImage?.url
      ? { url: p.featuredImage.url, alt: p.featuredImage.altText?.replace(/\s+/g, " ").trim() || name }
      : undefined,
  };
}

export function mapCollection(c: StorefrontCollection): Category {
  return { slug: c.handle, name: c.title ?? c.handle, description: c.description ?? "" };
}

export function createShopifyClient(cfg: ShopifyConfig): CommerceClient {
  const endpoint = `https://${cfg.storeDomain}/api/${cfg.apiVersion}/graphql.json`;

  async function query<T>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
    // Every operation here is a read, so retrying is safe.
    const res = await commerceFetch("Shopify Storefront API", endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(cfg.token) },
      body: JSON.stringify({ query: document, variables }),
    });
    if (!res.ok) throw new CommerceUpstreamError(`Shopify Storefront API request failed (${res.status})`, res.status);
    const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (json.errors?.length) {
      throw new CommerceUpstreamError(`Shopify Storefront API: ${json.errors.map((e) => e.message).join("; ")}`);
    }
    if (!json.data) throw new CommerceUpstreamError("Shopify Storefront API returned no data");
    return json.data;
  }

  return {
    async getCategories() {
      const data = await query<{ collections: { nodes: StorefrontCollection[] } }>(
        `query Collections { collections(first: 250) { nodes { handle title description } } }`,
      );
      return [...data.collections.nodes.map(mapCollection), ALL_CATEGORY];
    },
    async getCategory(_brand, slug) {
      if (slug === ALL_CATEGORY.slug) return ALL_CATEGORY;
      const data = await query<{ collection: StorefrontCollection | null }>(
        `query CollectionByHandle($handle: String!) { collection(handle: $handle) { handle title description } }`,
        { handle: slug },
      );
      return data.collection ? mapCollection(data.collection) : null;
    },
    async getFeatured(brand) {
      const data = await query<{ products: { nodes: StorefrontProduct[] } }>(
        `${PRODUCT_FIELDS} query Featured { products(first: 4, sortKey: BEST_SELLING) { nodes { ...ProductFields } } }`,
      );
      return data.products.nodes.map((p) => mapProduct(brand, p));
    },
    async listProducts(brand) {
      // One page of up to 250, the API maximum. A larger catalog needs cursor pagination.
      const data = await query<{ products: { nodes: StorefrontProduct[] } }>(
        `${PRODUCT_FIELDS} query ListProducts { products(first: 250) { nodes { ...ProductFields } } }`,
      );
      return data.products.nodes.map((p) => mapProduct(brand, p));
    },
    async getProductsByCategory(brand, category) {
      if (category === ALL_CATEGORY.slug) {
        const data = await query<{ products: { nodes: StorefrontProduct[] } }>(
          `${PRODUCT_FIELDS} query AllProducts { products(first: 24) { nodes { ...ProductFields } } }`,
        );
        return data.products.nodes.map((p) => mapProduct(brand, p));
      }
      const data = await query<{ collection: { products: { nodes: StorefrontProduct[] } } | null }>(
        `${PRODUCT_FIELDS} query CollectionProducts($handle: String!) {
          collection(handle: $handle) { products(first: 24) { nodes { ...ProductFields } } }
        }`,
        { handle: category },
      );
      return (data.collection?.products.nodes ?? []).map((p) => mapProduct(brand, p, category));
    },
    async getProduct(brand, id) {
      const data = await query<{ product: StorefrontProduct | null }>(
        `${PRODUCT_FIELDS} query ProductByHandle($handle: String!) { product(handle: $handle) { ...ProductFields } }`,
        { handle: id },
      );
      return data.product ? mapProduct(brand, data.product) : null;
    },
    async searchProducts(brand, text) {
      const q = text.trim();
      if (!q) return [];
      const data = await query<{ search: { nodes: Partial<StorefrontProduct>[] } }>(
        `${PRODUCT_FIELDS} query Search($q: String!) {
          search(query: $q, first: 24, types: PRODUCT) { nodes { ... on Product { ...ProductFields } } }
        }`,
        { q },
      );
      return data.search.nodes
        .filter((n): n is StorefrontProduct => typeof n.handle === "string")
        .map((p) => mapProduct(brand, p));
    },
  };
}
