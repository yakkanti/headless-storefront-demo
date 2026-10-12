export const BRAND_SLUGS = ["ridgeline", "tidewater", "driftwood"] as const;
export type BrandSlug = (typeof BRAND_SLUGS)[number];

export type Brand = {
  slug: BrandSlug;
  name: string;
  tagline: string;
  /** Brand accent color, exposed to CSS as --brand. */
  color: string;
  /** Darker shade for hover/contrast, exposed as --brand-dark. */
  colorDark: string;
  /** SFCC site ID the SCAPI client targets for this storefront. */
  sfccSiteId: string;
};

/**
 * Three fictional brands that share one codebase, one commerce layer and one
 * design system, with a thin brand config on top. Mirrors the "three brands, one
 * platform" shape without using any real retailer's name or assets.
 */
export const BRANDS: Record<BrandSlug, Brand> = {
  ridgeline: {
    slug: "ridgeline",
    name: "Ridgeline Outfitters",
    tagline: "Gear for the long weekend",
    color: "#2f6b3f",
    colorDark: "#1f4a2b",
    sfccSiteId: "Ridgeline",
  },
  tidewater: {
    slug: "tidewater",
    name: "Tidewater Marine",
    tagline: "Everything for the water",
    color: "#1d5f9c",
    colorDark: "#144470",
    sfccSiteId: "Tidewater",
  },
  driftwood: {
    slug: "driftwood",
    name: "Driftwood Supply",
    tagline: "Everyday wear, coastal roots",
    color: "#b4552d",
    colorDark: "#843b1c",
    sfccSiteId: "Driftwood",
  },
};

export function isBrandSlug(value: string): value is BrandSlug {
  return (BRAND_SLUGS as readonly string[]).includes(value);
}

export function getBrand(value: string): Brand | null {
  return isBrandSlug(value) ? BRANDS[value] : null;
}
