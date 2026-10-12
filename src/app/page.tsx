import Link from "next/link";
import { BRANDS, BRAND_SLUGS } from "@/lib/brands";
import { commerceSource } from "@/lib/commerce";

const DEMONSTRATES: { area: string; what: string; where: string; status: string }[] = [
  {
    area: "Headless frontend",
    what: "Next.js App Router, TypeScript, server rendering with cached data and streamed request-time content",
    where: "src/app/[brand]/*",
    status: "Built",
  },
  {
    area: "Multi-brand platform",
    what: "Three storefronts from one codebase: shared components and commerce layer, thin brand config for theme and site ID",
    where: "src/lib/brands.ts, src/app/[brand]/layout.tsx",
    status: "Built",
  },
  {
    area: "Commerce integration",
    what: "A CommerceClient interface with a mock catalog, a Shopify Storefront API adapter (GraphQL) and an SFCC SCAPI adapter (SLAS guest token, shopper-products, shopper-search)",
    where: "src/lib/commerce/*",
    status: "Mock built; SCAPI adapter written to spec, not yet run against a live realm",
  },
  {
    area: "SEO parity",
    what: "Canonical URLs, product JSON-LD, sitemap, robots, noindex on search, and 301 mapping from legacy URLs",
    where: "src/lib/seo.ts, next.config.ts, src/app/sitemap.ts",
    status: "Built and unit-tested",
  },
  {
    area: "Incremental cutover",
    what: "Strangler-fig routing: unmigrated routes proxy to the legacy storefront, migrated ones are served here",
    where: "migration.config.json, next.config.ts, /migration",
    status: "Built",
  },
  {
    area: "Performance and observability",
    what: "Priority LCP image, sized images, streaming skeletons, real-user Core Web Vitals beacons",
    where: "src/components/WebVitals.tsx, /api/vitals",
    status: "Built",
  },
  {
    area: "Cache control",
    what: "Tagged catalog caches and a secured revalidation webhook for catalog publish events",
    where: "src/lib/data.ts, /api/revalidate",
    status: "Built",
  },
  {
    area: "Quality and AI-assisted delivery",
    what: "Lint, typecheck, unit tests and build in CI; documented AI-assisted workflow with review guardrails",
    where: ".github/workflows/ci.yml, docs/AI_SDLC.md",
    status: "Built",
  },
];

export default function Home() {
  const source = commerceSource();
  return (
    <main id="main" className="container page">
      <section className="hero">
        <h1>Multi-brand headless commerce demo</h1>
        <p>
          A working reference for moving several storefronts from a monolithic commerce frontend to a headless
          Next.js frontend on Vercel, in increments, without losing SEO, performance or checkout reliability.
        </p>
        <p className="muted">
          Catalog source: <code>{source}</code>
          {source === "mock"
            ? " (set the SHOPIFY_* variables to switch to Shopify, or the SFCC_* variables for Salesforce Commerce Cloud)"
            : ""}
        </p>
      </section>

      <h2>Three brands, one platform</h2>
      <ul className="tiles">
        {BRAND_SLUGS.map((slug) => (
          <li key={slug} className="tile" style={{ borderTop: `4px solid ${BRANDS[slug].color}` }}>
            <Link href={`/${slug}`}>
              <h3>{BRANDS[slug].name}</h3>
            </Link>
            <p className="muted">{BRANDS[slug].tagline}</p>
          </li>
        ))}
      </ul>

      <h2>What this demonstrates</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Area</th>
              <th>What it shows</th>
              <th>Where</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {DEMONSTRATES.map((row) => (
              <tr key={row.area}>
                <th scope="row">{row.area}</th>
                <td>{row.what}</td>
                <td>
                  <code>{row.where}</code>
                </td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>
        <Link href="/migration">See the incremental migration plan &rarr;</Link>
      </p>
    </main>
  );
}
