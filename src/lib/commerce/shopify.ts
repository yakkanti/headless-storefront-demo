import "server-only";
import { type BrandSlug, isBrandSlug } from "../brands";
import { CartRejectedError, CommerceUpstreamError, commerceFetch } from "./http";
import type { Cart, CartContext, Category, CommerceClient, NewCartLine, Product } from "./types";

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
  featuredImage?: StorefrontImage | null;
  variants?: { nodes?: { id: string; title?: string; availableForSale?: boolean; price?: Money }[] };
};

type StorefrontImage = { url: string; altText?: string | null };

type StorefrontCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: Money };
  lines: {
    nodes: {
      id: string;
      quantity: number;
      attribute?: { value?: string | null } | null;
      cost: { totalAmount: Money; amountPerQuantity: Money };
      merchandise: {
        title?: string;
        image?: StorefrontImage | null;
        product: { handle: string; title?: string; featuredImage?: StorefrontImage | null };
      };
    }[];
  };
};

type CartPayload = { cart: StorefrontCart | null; userErrors: { code?: string | null; message: string }[] };

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

/** Variants are only fetched for a single product: on a listing they would multiply the query cost. */
const PRODUCT_DETAIL_FIELDS = `
  ${PRODUCT_FIELDS}
  fragment ProductDetailFields on Product {
    ...ProductFields
    variants(first: 100) { nodes { id title availableForSale price { amount } } }
  }
`;

/** Hidden from the buyer at checkout because of the leading underscore. */
const BRAND_ATTRIBUTE = "_brand";

/** Shopify's name for the only variant of a product that has no options. */
const DEFAULT_VARIANT_TITLE = "Default Title";

const CART_FIELDS = `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost { subtotalAmount { amount currencyCode } }
    lines(first: 100) {
      nodes {
        id
        quantity
        attribute(key: "${BRAND_ATTRIBUTE}") { value }
        cost { totalAmount { amount currencyCode } amountPerQuantity { amount currencyCode } }
        merchandise {
          ... on ProductVariant {
            title
            image { url altText }
            product { handle title featuredImage { url altText } }
          }
        }
      }
    }
  }
`;

const cleanAlt = (image: StorefrontImage, fallback: string) => image.altText?.replace(/\s+/g, " ").trim() || fallback;

export function mapCart(c: StorefrontCart): Cart {
  return {
    id: c.id,
    checkoutUrl: c.checkoutUrl,
    totalQuantity: c.totalQuantity,
    subtotal: Number(c.cost.subtotalAmount.amount),
    currency: c.cost.subtotalAmount.currencyCode,
    lines: c.lines.nodes.map((line) => {
      const { merchandise } = line;
      const name = merchandise.product.title ?? merchandise.product.handle;
      const image = merchandise.image ?? merchandise.product.featuredImage;
      const brand = line.attribute?.value;
      return {
        id: line.id,
        quantity: line.quantity,
        brand: brand && isBrandSlug(brand) ? brand : null,
        productId: merchandise.product.handle,
        name,
        // A single-variant product repeats its own name, or Shopify's placeholder, as the variant title.
        variantTitle:
          merchandise.title && merchandise.title !== DEFAULT_VARIANT_TITLE && merchandise.title !== name
            ? merchandise.title
            : "",
        unitPrice: Number(line.cost.amountPerQuantity.amount),
        lineTotal: Number(line.cost.totalAmount.amount),
        image: image ? { url: image.url, alt: cleanAlt(image, name) } : undefined,
      };
    }),
  };
}

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
    image: p.featuredImage?.url ? { url: p.featuredImage.url, alt: cleanAlt(p.featuredImage, name) } : undefined,
    variants: p.variants?.nodes?.map((v) => ({
      id: v.id,
      title: v.title && v.title !== DEFAULT_VARIANT_TITLE ? v.title : name,
      price: Number(v.price?.amount ?? price),
      available: v.availableForSale ?? true,
    })),
  };
}

export function mapCollection(c: StorefrontCollection): Category {
  return { slug: c.handle, name: c.title ?? c.handle, description: c.description ?? "" };
}

export function createShopifyClient(cfg: ShopifyConfig): CommerceClient {
  const endpoint = `https://${cfg.storeDomain}/api/${cfg.apiVersion}/graphql.json`;

  /** Reads use the default policy and may be retried. Cart writes pass `retries: 0`. */
  async function query<T>(
    document: string,
    variables: Record<string, unknown> = {},
    { retries, buyerIp }: { retries?: number; buyerIp?: string } = {},
  ): Promise<T> {
    const res = await commerceFetch(
      "Shopify Storefront API",
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(cfg.token),
          // Server-side requests all come from one IP; Shopify asks for the buyer's so its
          // bot protection and rate limits apply per shopper, not to the whole storefront.
          ...(buyerIp ? { "Shopify-Storefront-Buyer-IP": buyerIp } : {}),
        },
        body: JSON.stringify({ query: document, variables }),
      },
      retries === undefined ? {} : { retries },
    );
    if (!res.ok) throw new CommerceUpstreamError(`Shopify Storefront API request failed (${res.status})`, res.status);
    const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (json.errors?.length) {
      throw new CommerceUpstreamError(`Shopify Storefront API: ${json.errors.map((e) => e.message).join("; ")}`);
    }
    if (!json.data) throw new CommerceUpstreamError("Shopify Storefront API returned no data");
    return json.data;
  }

  const toLineInput = (line: NewCartLine) => ({
    merchandiseId: line.variantId,
    quantity: line.quantity,
    attributes: [{ key: BRAND_ATTRIBUTE, value: line.brand }],
  });

  /** Runs one cart mutation, never retried, and turns Shopify's userErrors into a typed rejection. */
  async function mutateCart(field: string, args: string, call: string, variables: Record<string, unknown>, ctx?: CartContext) {
    const data = await query<Record<string, CartPayload>>(
      `${CART_FIELDS} mutation ${field}(${args}) {
        ${field}(${call}) { cart { ...CartFields } userErrors { code message } }
      }`,
      variables,
      { retries: 0, buyerIp: ctx?.buyerIp },
    );
    const { cart, userErrors } = data[field];
    if (userErrors.length > 0 || !cart) {
      throw new CartRejectedError(userErrors.map((e) => e.message).join("; ") || "Cart not found");
    }
    return mapCart(cart);
  }

  return {
    cart: {
      async getCart(id, ctx) {
        const data = await query<{ cart: StorefrontCart | null }>(
          `${CART_FIELDS} query Cart($id: ID!) { cart(id: $id) { ...CartFields } }`,
          { id },
          { buyerIp: ctx?.buyerIp },
        );
        return data.cart ? mapCart(data.cart) : null;
      },
      createCart: (lines, ctx) =>
        mutateCart("cartCreate", "$input: CartInput!", "input: $input", { input: { lines: lines.map(toLineInput) } }, ctx),
      addLines: (id, lines, ctx) =>
        mutateCart(
          "cartLinesAdd",
          "$cartId: ID!, $lines: [CartLineInput!]!",
          "cartId: $cartId, lines: $lines",
          { cartId: id, lines: lines.map(toLineInput) },
          ctx,
        ),
      updateLine: (id, lineId, quantity, ctx) =>
        quantity > 0
          ? mutateCart(
              "cartLinesUpdate",
              "$cartId: ID!, $lines: [CartLineUpdateInput!]!",
              "cartId: $cartId, lines: $lines",
              { cartId: id, lines: [{ id: lineId, quantity }] },
              ctx,
            )
          : mutateCart(
              "cartLinesRemove",
              "$cartId: ID!, $lineIds: [ID!]!",
              "cartId: $cartId, lineIds: $lineIds",
              { cartId: id, lineIds: [lineId] },
              ctx,
            ),
    },
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
        `${PRODUCT_DETAIL_FIELDS} query ProductByHandle($handle: String!) {
          product(handle: $handle) { ...ProductDetailFields }
        }`,
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
