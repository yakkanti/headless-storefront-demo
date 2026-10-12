import { describe, expect, it } from "vitest";

/**
 * Black-box checks against a running server: `SMOKE_URL=http://localhost:3000 npm test`.
 * Skipped unless SMOKE_URL is set. These guard the things a migration must not
 * break: real 404 status codes, 301-style redirects for legacy URLs, and SEO output.
 */
const base = process.env.SMOKE_URL;
const run = base ? describe : describe.skip;

const get = (path: string, init?: RequestInit) => fetch(new URL(path, base), { redirect: "manual", ...init });

run("smoke", () => {
  it.each(["/", "/ridgeline", "/tidewater/c/safety", "/driftwood/p/DW-1001", "/migration", "/sitemap.xml", "/robots.txt"])(
    "%s returns 200",
    async (path) => {
      expect((await get(path)).status).toBe(200);
    },
  );

  it.each(["/nope", "/ridgeline/p/NOPE", "/ridgeline/c/nope"])("%s returns a real 404, not a soft 404", async (path) => {
    expect((await get(path)).status).toBe(404);
  });

  it("serves every sitemap URL, whichever catalog is active", async () => {
    const xml = await (await get("/sitemap.xml")).text();
    const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    expect(paths.length).toBeGreaterThan(0);
    const statuses = await Promise.all(paths.map(async (p) => [p, (await get(p)).status] as const));
    expect(statuses.filter(([, status]) => status !== 200)).toEqual([]);
  });

  it("redirects legacy product URLs permanently", async () => {
    const res = await get("/ridgeline/product/basecamp-tent/RL-1001.html");
    expect([301, 308]).toContain(res.status);
    expect(new URL(res.headers.get("location")!, base).pathname).toBe("/ridgeline/p/RL-1001");
  });

  it("emits canonical, Product JSON-LD and keeps search out of the index", async () => {
    const pdp = await (await get("/ridgeline/p/RL-1001")).text();
    expect(pdp).toContain('rel="canonical"');
    expect(pdp).toContain('"@type":"Product"');
    const search = await (await get("/ridgeline/search?q=tent")).text();
    expect(search).toContain("noindex");
  });

  it("escapes reflected search input", async () => {
    const html = await (await get("/ridgeline/search?q=%3Cscript%3Ealert(1)%3C/script%3E")).text();
    expect(html).not.toContain("<script>alert(1)");
  });

  it("protects the revalidation webhook", async () => {
    const res = await get("/api/revalidate", { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
  });
});
