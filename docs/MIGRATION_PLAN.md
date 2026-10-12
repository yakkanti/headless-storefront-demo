# Migration plan: monolithic storefront to headless

The business has to keep selling the whole time. The plan is a strangler-fig migration: the new frontend takes over one
route at a time, and everything else keeps running on the existing platform until its turn.

## Phases

| Phase | Scope | Why this order | Exit criteria |
|---|---|---|---|
| 0. Baseline | No traffic change | You cannot prove parity without a baseline | Core Web Vitals, rankings, conversion and analytics events recorded per page type |
| 1. Home and search | Lowest-risk, high-visibility | Small surface, easy to roll back | Vitals at parity or better; analytics events match; no ranking loss |
| 2. Category and product pages | Highest SEO weight | Redirect map and canonical tags are tested first | 301 map verified, sitemap diffed, product markup validated, rankings stable for 2 weeks |
| 3. Cart and checkout | Revenue-critical | Moves only after everything around it is proven | Behind a flag, one brand at a time, conversion tracked live, never during peak season |
| 4. Account | Session handoff | Depends on auth and basket state | Token handoff verified end to end |

Each phase repeats per brand: smallest or lowest-traffic brand first, then the others.

## Rollout mechanics

- Routes are switched in `migration.config.json`, so cutover and rollback are config changes, not code rewrites.
- A percentage-based rollout (by cookie or header) can sit in front of any route for staged exposure.
- Every cutover has an owner, a rollback trigger (for example, conversion down by a set threshold for a set time) and
  a communication plan.

## What protects SEO

1. Permanent redirects from every legacy URL that has search equity (`legacyToNew` is unit-tested).
2. Canonical tags and sitemaps generated from the same URL helpers, so they cannot drift.
3. Product structured data (JSON-LD) at parity or better.
4. `noindex` on search results and other thin pages; real 404s for dead URLs, never soft 404s.
5. Rankings and crawl errors monitored through each cutover.

## Top risks and responses

| Risk | Response |
|---|---|
| Ranking loss from URL changes | Redirect map plus sitemap diff before every cutover; monitor Search Console |
| Slower pages than the legacy site | Performance budgets in CI; image and caching strategy; compare real-user vitals |
| Analytics gaps | Event contract defined up front and checked against the baseline |
| Checkout instability | Moves last, flagged, one brand at a time, with a tested rollback |
| Knowledge held by one vendor | Pairing, docs and runbooks required in every SOW; shared code ownership |
| Peak-season freeze | Cutovers scheduled around it; code freeze rules agreed with the business |

## First 90 days (if leading this)

1. Ship a production change myself to learn the codebase, the brands and the release path.
2. Set up a steady 1:1 and team cadence across time zones, with overlap windows and async documentation.
3. Name the top migration risks and put an owner and a plan against each.
4. Baseline how the team uses AI today and where it should go next across the SDLC (see [AI_SDLC.md](AI_SDLC.md)).
