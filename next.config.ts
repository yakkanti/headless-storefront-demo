import { readFileSync } from "node:fs";
import type { NextConfig } from "next";
import { assertCommerceEnv } from "./src/lib/commerce/config";

// Fail at startup, before any page is built, if a catalog provider is half-configured.
assertCommerceEnv();

type MigrationRoute = { name: string; pattern: string; status: "migrated" | "legacy" };

const migration = JSON.parse(readFileSync(new URL("./migration.config.json", import.meta.url), "utf8")) as {
  routes: MigrationRoute[];
};

const BRANDS = "ridgeline|tidewater|driftwood";

/**
 * Strangler-fig cutover: any route still marked "legacy" is proxied to the
 * existing SFCC storefront (LEGACY_ORIGIN) so the business keeps selling while
 * pages are migrated in increments. With LEGACY_ORIGIN unset (local dev, demo),
 * the local placeholder pages are served instead.
 */
const legacyOrigin = process.env.LEGACY_ORIGIN?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Off on purpose: with it on, unlisted URLs stream an app shell first, so the
  // response status is already 200 by the time notFound() runs (a soft 404).
  partialPrefetching: false,

  images: {
    // Product photos served by the Shopify adapter.
    remotePatterns: [{ protocol: "https", hostname: "cdn.shopify.com", pathname: "/s/files/**" }],
  },

  async rewrites() {
    if (!legacyOrigin) return [];
    return {
      beforeFiles: migration.routes
        .filter((r) => r.status === "legacy")
        .map((r) => ({ source: r.pattern, destination: `${legacyOrigin}${r.pattern}` })),
    };
  },

  async redirects() {
    // Old SFCC URLs keep their search equity via permanent redirects.
    // Mirrors legacyToNew() in src/lib/seo.ts, which is unit-tested.
    return [
      {
        source: `/:brand(${BRANDS})/product/:slug/:pid.html`,
        destination: "/:brand/p/:pid",
        permanent: true,
      },
      {
        source: `/:brand(${BRANDS})/category/:category`,
        destination: "/:brand/c/:category",
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
