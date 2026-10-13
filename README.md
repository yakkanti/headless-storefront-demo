# Multi-brand headless commerce demo

A portfolio project showing how I would move several storefronts from a monolithic commerce frontend to a
headless **Next.js** frontend on **Vercel**, in increments, without losing SEO, performance or checkout reliability.

It is built around a Salesforce Commerce Cloud (SFCC) migration, but runs standalone on a mock catalog.

> **Fictional brands, mock data.** Ridgeline Outfitters, Tidewater Marine and Driftwood Supply are made up.
> This project is not affiliated with any retailer.

## What it shows

| Area | What's here | Status |
|---|---|---|
| Headless frontend | Next.js App Router, TypeScript, cached server rendering, streamed request-time content | Built |
| Multi-brand | Three storefronts from one codebase: shared components and commerce layer, thin per-brand config | Built |
| Commerce integration | `CommerceClient` interface, mock catalog, Shopify Storefront API adapter (GraphQL: collections, products, search), SFCC SCAPI adapter (SLAS guest token, shopper-products, shopper-search) | Mock built. Shopify adapter built and run against a live development store. **SCAPI adapter is written to the documented API but has not been run against a live SFCC realm** |
| SEO parity | Canonical URLs, product JSON-LD, sitemap, robots, `noindex` on search, legacy-URL permanent redirects, true 404 status codes | Built, unit and smoke tested |
| Incremental cutover | Strangler-fig routing driven by `migration.config.json`: legacy routes proxy to the old storefront | Built |
| Performance | Priority LCP image, sized images, streaming skeletons, real-user Core Web Vitals to `/api/vitals` | Built |
| Cache control | Tagged catalog caches and a secured `POST /api/revalidate` webhook | Built |
| Quality | Lint, typecheck, unit tests, production-build smoke tests in CI | Built |
| AI in the SDLC | Workflow and guardrails in [docs/AI_SDLC.md](docs/AI_SDLC.md) | Documented |

Cart and checkout hand-off work when Shopify is the catalog: add to cart from a product page, change quantities,
and continue to Shopify's hosted checkout. On the mock and SFCC sources they are not built, on purpose: in the
migration plan they move last, behind a flag, and never during peak season. Accounts and payments are not built on
any source. See [docs/MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md).

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run lint && npm run typecheck && npm test      # unit tests
npm run build && npm run start                      # production build
SMOKE_URL=http://localhost:3000 npm test            # + black-box smoke tests against the running server
```

Copy `.env.example` to `.env.local` to change settings. With nothing set, the mock catalog is used.

### Use a Shopify store as the catalog

1. In the store admin, install the **Headless** sales channel and create a storefront.
2. Copy its private access token (or the public one) and make sure products are published to the Headless channel.
3. Set `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_STOREFRONT_TOKEN` in `.env.local`, then restart the dev server.

Collections become categories (plus an "All products" catch-all) and product handles become product IDs (`/ridgeline/p/<handle>`). One store backs
all three demo brands, so they show the same catalog.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, **Add New → Project**, import the repo, keep the detected Next.js settings, and deploy.
3. Optional environment variables: `REVALIDATE_SECRET` (enables the webhook), `NEXT_PUBLIC_SITE_URL`
   (otherwise the Vercel production URL is used for canonical URLs and the sitemap).
4. To serve the Shopify catalog, also set `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_STOREFRONT_TOKEN` for the
   Production and Preview environments. The build reads the catalog to prerender pages and write the sitemap,
   so the variables must be set before the first deploy, and a redeploy is needed if they change.

Or with the CLI: `npx vercel` (preview) then `npx vercel --prod`.

## Key decisions

- **`partialPrefetching: false`.** With it on, URLs that were not prerendered stream an app shell first, so the
  response status is already 200 when `notFound()` runs. That produces soft 404s, which is the opposite of what a
  migration needs. Known URLs are all prerendered; unknown ones now return a real 404.
- **Params are validated in the layout and in every page.** Layouts and pages render in parallel, so a page cannot
  assume the layout has already rejected a bad brand.
- **Data is cached per resource with tags** (`catalog:<brand>`, `product:<brand>:<id>`), so a catalog-publish event
  can purge exactly what changed.
- **Search pages are `noindex`.** They are thin, near-infinite URLs.
- **308 vs 301.** Next.js emits 308 for permanent redirects. Search engines treat it the same as 301.

- **A half-configured provider is an error.** Setting only some of a provider's variables stops the build with a
  message naming what is missing, instead of deploying the mock catalog by accident.
- **Provider calls share one transport policy** (`src/lib/commerce/http.ts`): an 8 second timeout and one retry on
  network errors, 429 and 5xx. Pages already cached keep serving through an outage; uncached ones show a
  retryable error page and return 500.
- **Invalidation fans out.** Purging any brand-scoped tag also purges that brand's catalog, and every brand when
  one catalog backs them all, so a listing never keeps a price its product page has dropped.

- **The cart lives in Shopify, not here.** The browser holds only the cart ID in an httpOnly cookie, cart writes
  are plain form posts to Server Functions (they work without JavaScript), and payment happens on Shopify's hosted
  checkout, so no card data touches this app. Cart writes are never retried, because a retried add could add twice.

## Honest limitations

- The SCAPI adapter needs validation against a real realm (auth flow, response shapes, site IDs).
- The Shopify adapter is not brand-scoped, reads at most 24 products per collection and 250 products or
  collections per store (no pagination), and shows one image per product. Variants are not modelled: a product
  whose variants differ in price shows "From" the lowest.
- Catalog edits appear after the cache lifetime (about an hour) unless `/api/revalidate` is called. Nothing calls
  it automatically yet; a Shopify `products/update` webhook would.
- Sitemap and static params are built from the active catalog at build time. A large catalog needs sitemap
  splitting and a cap on prerendered products.
- Checkout on a Shopify development store sits behind the store password, so a visitor is asked for it at
  hand-off. A live store has no such step.
- The cart has no item count in the header, no discount codes and no subscription (selling plan) options.
- No end-to-end browser tests yet (Playwright would be next), and no load or performance budget enforcement in CI.
- Images are SVG placeholders for the mock and SFCC sources. The Shopify source shows each product's featured image.
