import type { BrandSlug } from "../brands";

/** A purchasable option of a product (size, colour, pack). */
export type Variant = {
  /** Opaque provider ID; this is what goes into a cart. */
  id: string;
  title: string;
  price: number;
  available: boolean;
};

export type Product = {
  id: string;
  brand: BrandSlug;
  category: string;
  name: string;
  /** Lowest price across variants. */
  price: number;
  /** Highest variant price, set only when variants differ in price. */
  priceMax?: number;
  /** ISO 4217 code. */
  currency: string;
  description: string;
  badge?: string;
  /** Remote product photo. Absent for sources without images; the UI falls back to a brand placeholder. */
  image?: { url: string; alt: string };
  /** Present on a single-product read from a source that supports carts. */
  variants?: Variant[];
  inStock: boolean;
};

export type Category = {
  slug: string;
  name: string;
  description: string;
};

/**
 * The storefront talks only to this interface. Swapping the mock catalog for
 * Shopify (Storefront API) or Salesforce Commerce Cloud (SCAPI) is a
 * configuration change, not a rewrite.
 */
export interface CommerceClient {
  getCategories(brand: BrandSlug): Promise<Category[]>;
  /** Direct lookup, so a category outside the listed page of categories still resolves. */
  getCategory(brand: BrandSlug, slug: string): Promise<Category | null>;
  getFeatured(brand: BrandSlug): Promise<Product[]>;
  /** The whole catalog for a brand, used to prerender product pages and build the sitemap. */
  listProducts(brand: BrandSlug): Promise<Product[]>;
  getProductsByCategory(brand: BrandSlug, category: string): Promise<Product[]>;
  getProduct(brand: BrandSlug, id: string): Promise<Product | null>;
  searchProducts(brand: BrandSlug, query: string): Promise<Product[]>;
  /** Absent when the source has no cart. The UI then leaves purchasing to the legacy platform. */
  cart?: CartClient;
}

export type CartLine = {
  id: string;
  quantity: number;
  /** Storefront the line was added from, so the cart can link back to the right brand. */
  brand: BrandSlug | null;
  productId: string;
  name: string;
  /** Empty for a product with a single variant. */
  variantTitle: string;
  unitPrice: number;
  lineTotal: number;
  image?: { url: string; alt: string };
};

export type Cart = {
  /** Opaque and secret: whoever holds it can read and change the cart. */
  id: string;
  /** Provider-hosted checkout for this cart. */
  checkoutUrl: string;
  totalQuantity: number;
  subtotal: number;
  currency: string;
  lines: CartLine[];
};

export type NewCartLine = { variantId: string; quantity: number; brand: BrandSlug };

/** Per-request context a provider may want for fraud and rate-limit decisions. */
export type CartContext = { buyerIp?: string };

/**
 * Cart writes are not idempotent, so implementations must not retry them:
 * a retried "add" could put the item in twice.
 */
export interface CartClient {
  /** Null when the cart is unknown, expired or already checked out. */
  getCart(id: string, ctx?: CartContext): Promise<Cart | null>;
  createCart(lines: NewCartLine[], ctx?: CartContext): Promise<Cart>;
  addLines(id: string, lines: NewCartLine[], ctx?: CartContext): Promise<Cart>;
  /** Quantity 0 removes the line. */
  updateLine(id: string, lineId: string, quantity: number, ctx?: CartContext): Promise<Cart>;
}
