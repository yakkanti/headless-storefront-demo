import type { Product } from "./commerce/types";
import { BRANDS, isBrandSlug, type BrandSlug } from "./brands";

const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined;

/** Canonical origin: explicit override, then the Vercel production domain, then local dev. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? vercelUrl ?? "http://localhost:3000").replace(/\/$/, "");

export const productPath = (brand: BrandSlug, id: string) => `/${brand}/p/${id}`;
export const categoryPath = (brand: BrandSlug, category: string) => `/${brand}/c/${category}`;

/**
 * Legacy SFCC storefront URLs -> new headless URLs.
 *
 * During a cutover every old URL that has search equity must 301 to its new
 * home, or rankings are lost. This pure function is unit-tested, and the same
 * patterns are applied as redirects in next.config.ts.
 *
 *   /ridgeline/product/basecamp-tent/RL-1001.html  ->  /ridgeline/p/RL-1001
 *   /ridgeline/category/tents                      ->  /ridgeline/c/tents
 */
export function legacyToNew(pathname: string): string | null {
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  const [brand, kind, ...rest] = parts;
  if (!brand || !isBrandSlug(brand)) return null;

  if (kind === "product" && rest.length === 2 && rest[1].endsWith(".html")) {
    return productPath(brand, rest[1].slice(0, -".html".length));
  }
  if (kind === "category" && rest.length === 1) {
    return categoryPath(brand, rest[0]);
  }
  return null;
}

/** schema.org Product markup for rich results. `<` is escaped to keep the payload inert in HTML. */
export function productJsonLd(product: Product) {
  const brand = BRANDS[product.brand];
  const json = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.id,
    description: product.description,
    brand: { "@type": "Brand", name: brand.name },
    url: `${SITE_URL}${productPath(product.brand, product.id)}`,
    image: product.image?.url ?? `${SITE_URL}/img/${product.brand}.svg`,
    offers: {
      // A product whose variants differ in price is a range, not a single offer.
      ...(product.priceMax
        ? { "@type": "AggregateOffer", lowPrice: product.price.toFixed(2), highPrice: product.priceMax.toFixed(2) }
        : { "@type": "Offer", price: product.price.toFixed(2) }),
      priceCurrency: product.currency,
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
  return JSON.stringify(json).replace(/</g, "\\u003c");
}
