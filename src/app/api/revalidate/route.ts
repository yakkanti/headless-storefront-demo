import { revalidateTag } from "next/cache";
import { expandTags } from "@/lib/cache-tags";
import { commerceSource } from "@/lib/commerce";

/**
 * Catalog-publish webhook. When SFCC publishes catalog changes, call this with
 * the tags that changed (for example "catalog:ridgeline" or "product:ridgeline:RL-1001").
 * A brand-scoped tag also purges that brand's catalog, so listings do not keep a
 * stale price (see lib/cache-tags.ts). Cached pages refresh on their next visit and are served stale-while-revalidate,
 * so shoppers never wait on a purge.
 *
 *   curl -X POST $URL/api/revalidate -H "x-revalidate-secret: $REVALIDATE_SECRET" \
 *     -H "content-type: application/json" -d '{"tags":["catalog:ridgeline"]}'
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("x-revalidate-secret") !== secret) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let tags: unknown;
  try {
    ({ tags } = (await request.json()) as { tags?: unknown });
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  if (!Array.isArray(tags) || tags.length === 0 || !tags.every((t) => typeof t === "string" && t.length <= 256)) {
    return Response.json({ ok: false, error: "tags must be a non-empty array of strings" }, { status: 400 });
  }

  const expanded = expandTags(tags as string[], commerceSource() === "shopify");
  for (const tag of expanded) revalidateTag(tag, "max");
  return Response.json({ ok: true, revalidated: expanded });
}
