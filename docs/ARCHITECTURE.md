# Architecture

```
Browser ──► Vercel (Next.js 16, App Router)
              │
              ├─ Prerendered shells + cached catalog reads  ──► CommerceClient
              │                                                  ├─ mock catalog (default)
              │                                                  ├─ Shopify adapter ──► Shopify (Storefront API, GraphQL)
              │                                                  └─ SCAPI adapter ──► SFCC (SLAS + Shopper APIs)
              ├─ Streamed request-time content (search)
              ├─ rewrites ──► LEGACY_ORIGIN (routes still marked "legacy")
              ├─ /api/revalidate  ◄── catalog-publish webhook
              └─ /api/vitals      ◄── real-user Core Web Vitals
```

## Layers

| Layer | Responsibility | Code |
|---|---|---|
| Brand config | Theme, site ID, name per storefront | `src/lib/brands.ts` |
| Commerce interface | The only contract the UI depends on | `src/lib/commerce/types.ts` |
| Adapters | Mock catalog; Shopify Storefront API; SFCC SCAPI | `src/lib/commerce/mock.ts`, `shopify.ts`, `scapi.ts` |
| Cached data access | `use cache`, explicit lifetimes, tags | `src/lib/data.ts` |
| SEO helpers | Canonical paths, JSON-LD, legacy URL map | `src/lib/seo.ts` |
| Routing and cutover | Redirects, legacy proxying | `next.config.ts`, `migration.config.json` |
| UI | Brand shell, PLP, PDP, search | `src/app/[brand]/*` |

## Multi-brand approach

One deployment serves all brands under `/[brand]`. In production each brand would typically get its own domain,
mapped to the same deployment with a rewrite or proxy rule on the brand segment. Shared components and the commerce
layer are reused; brand differences live in config (theme, SFCC site ID) and, where a brand truly diverges, in
brand-specific components behind the same props.

## Rendering and caching

- Known brands, categories and products are read from the active catalog and prerendered at build time.
- Catalog reads are cached with `cacheLife` and tagged. A publish event invalidates tags, and pages refresh on their
  next visit, served stale-while-revalidate so shoppers never wait on a purge.
- Search depends on `searchParams`, so it streams: a static shell, then results behind a Suspense boundary.
- Unknown URLs render on demand and return a real 404.

## SFCC integration notes

- Guest sessions use the SLAS public-client PKCE flow. Tokens are cached per site until shortly before expiry.
- Catalog data comes from shopper-products and shopper-search. Each brand maps to an SFCC site ID.
- **Unvalidated:** the adapter follows the documented API but has not been run against a live realm.
- Not covered: baskets, checkout, customer sessions, and OCAPI. Those belong to later phases.

## Shopify integration notes

- Catalog data comes from the Storefront API over GraphQL, authenticated with a Headless-channel token. A private
  token is sent as `Shopify-Storefront-Private-Token`, a public one as `X-Shopify-Storefront-Access-Token`.
- Collections map to categories, plus an "All products" catch-all for products in no collection; the product
  handle is the product ID. Price is the lowest variant price, and a
  higher compare-at price shows a "Sale" badge.
- One store backs all brands. Brand scoping (a store per brand, or a brand tag filter) is not implemented.
- Each product's featured image is served from `cdn.shopify.com` through `next/image` (allowed in `next.config.ts`).
- Cart: `CommerceClient.cart` is optional and only Shopify implements it, through the Storefront API cart
  mutations. The cart ID is a bearer secret kept in an httpOnly cookie; cart reads are never cached; writes go
  through Server Functions with `retries: 0` and pass the buyer's IP, as Shopify asks of server-side callers.
  Each line carries a hidden `_brand` attribute so one cart can hold items from several storefronts.
- Checkout: `/checkout` redirects to the cart's `checkoutUrl` on Shopify's hosted checkout. Nothing about payment
  is handled in this app.
- Not covered: pagination past 24 products, image galleries, selling plans, discount codes, customer accounts.

## Failure modes to design for

| Risk | Mitigation |
|---|---|
| Provider slow or down | Cached reads keep pages serving. Every call has a timeout and one retry on network errors, 429 and 5xx (`commerce/http.ts`); uncached pages show a retryable error page. Not built: stale-if-error, circuit breaking |
| Token expiry mid-request | Per-site token cache with expiry margin; one retry with a fresh token on 401 (unvalidated, like the rest of the SCAPI adapter) |
| Provider half-configured | Startup check in `commerce/config.ts` fails the build and names the missing variables |
| Product purge leaves listings stale | `/api/revalidate` expands brand-scoped tags to the brand catalog, or all brands for a shared catalog (`lib/cache-tags.ts`) |
| Catalog publish not reflected | Tag-based revalidation webhook, with a time-based fallback via `cacheLife` |
| SEO regression at cutover | Redirect map tests, sitemap diff, canonical checks in CI, rank monitoring |
| Performance regression | Core Web Vitals baselined before and compared after each phase |
