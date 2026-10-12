import type { BrandSlug } from "../brands";

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
}
