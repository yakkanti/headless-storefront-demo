import type { MetadataRoute } from "next";
import { BRAND_SLUGS } from "@/lib/brands";
import { getCategories, listProducts } from "@/lib/data";
import { SITE_URL, categoryPath, productPath } from "@/lib/seo";

/**
 * One sitemap covering every brand, read from the active catalog. Split per
 * brand with generateSitemaps once a site exceeds 50,000 URLs.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => `${SITE_URL}${path}`;
  const brands = await Promise.all(
    BRAND_SLUGS.map(async (brand) => {
      const [categories, products] = await Promise.all([getCategories(brand), listProducts(brand)]);
      return [
        { url: url(`/${brand}`), changeFrequency: "daily" as const, priority: 1 },
        ...categories.map((c) => ({
          url: url(categoryPath(brand, c.slug)),
          changeFrequency: "daily" as const,
          priority: 0.8,
        })),
        ...products.map((p) => ({
          url: url(productPath(brand, p.id)),
          changeFrequency: "weekly" as const,
          priority: 0.6,
        })),
      ];
    }),
  );
  return [
    { url: url("/"), changeFrequency: "monthly", priority: 0.3 },
    { url: url("/migration"), changeFrequency: "monthly", priority: 0.2 },
    ...brands.flat(),
  ];
}
