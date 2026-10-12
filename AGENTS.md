<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project standards

- Read the bundled Next.js docs before changing routing, caching or metadata (see above). Do not rely on memory.
- The UI talks only to `CommerceClient` (`src/lib/commerce/types.ts`). Never import an adapter from a component.
- Every dynamic route validates its params itself and calls `notFound()` before anything streams. Layouts and pages
  render in parallel, so a page cannot assume its layout already rejected a bad param.
- Keep `partialPrefetching: false` unless unknown URLs are verified to still return a real 404 (see README).
- Catalog reads go through `src/lib/data.ts` with `cacheLife` and `cacheTag`. Do not fetch catalog data directly in pages.
- Any URL change needs a redirect and a test in `tests/seo.test.ts`. Do not ship a URL change without one.
- Before finishing: `npm run lint && npm run typecheck && npm test && npm run build`, then run the smoke tests
  with `SMOKE_URL` against `npm run start`.
