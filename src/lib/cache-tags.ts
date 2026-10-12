import { BRAND_SLUGS, isBrandSlug } from "./brands";

/**
 * Event-to-tag fan-out for cache invalidation.
 *
 * A product appears in listings, featured rows and search as well as on its own
 * page, each cached under a different tag. Purging only `product:<brand>:<id>`
 * would refresh the product page and leave its old price in every listing, so
 * any brand-scoped tag also purges that brand's whole catalog. When one catalog
 * backs every brand (Shopify), the purge covers all of them.
 */
export function expandTags(tags: string[], sharedCatalog: boolean): string[] {
  const out = new Set(tags);
  for (const tag of tags) {
    const brand = tag.split(":")[1];
    if (!brand || !isBrandSlug(brand)) continue;
    for (const b of sharedCatalog ? BRAND_SLUGS : [brand]) out.add(`catalog:${b}`);
  }
  return [...out];
}
