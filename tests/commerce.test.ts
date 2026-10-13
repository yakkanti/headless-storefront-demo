import { afterEach, describe, expect, it, vi } from "vitest";
import { mockClient } from "@/lib/commerce/mock";
import { commerceSource } from "@/lib/commerce";
import { CartRejectedError, CommerceUpstreamError, commerceFetch } from "@/lib/commerce/http";
import { mapHit, mapProduct, scapiConfigFromEnv } from "@/lib/commerce/scapi";
import {
  authHeader,
  createShopifyClient,
  mapCollection,
  mapProduct as mapShopifyProduct,
  shopifyConfigFromEnv,
} from "@/lib/commerce/shopify";

describe("mock catalog", () => {
  it("is scoped per brand", async () => {
    const products = await mockClient.getProductsByCategory("tidewater", "safety");
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((p) => p.brand === "tidewater" && p.category === "safety")).toBe(true);
  });

  it("returns null for a product from another brand", async () => {
    expect(await mockClient.getProduct("tidewater", "RL-1001")).toBeNull();
  });

  it("searches name, description and category, and ignores blank queries", async () => {
    expect((await mockClient.searchProducts("ridgeline", "tent")).length).toBeGreaterThan(0);
    expect(await mockClient.searchProducts("ridgeline", "   ")).toEqual([]);
  });
});

describe("source selection", () => {
  it("uses the mock catalog when nothing is set, and SFCC when every SFCC variable is", () => {
    expect(commerceSource({} as NodeJS.ProcessEnv)).toBe("mock");
    expect(
      commerceSource({
        SFCC_SHORT_CODE: "abc",
        SFCC_ORG_ID: "f_ecom_x_001",
        SFCC_CLIENT_ID: "id",
        SFCC_REDIRECT_URI: "https://example.com/cb",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe("scapi");
    expect(scapiConfigFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it("rejects a half-configured provider instead of falling back to mock", () => {
    expect(() => commerceSource({ SFCC_SHORT_CODE: "abc" } as unknown as NodeJS.ProcessEnv)).toThrow(
      /SFCC catalog is partly configured: missing SFCC_ORG_ID, SFCC_CLIENT_ID, SFCC_REDIRECT_URI/,
    );
    expect(() => commerceSource({ SHOPIFY_STORE_DOMAIN: "x.myshopify.com" } as unknown as NodeJS.ProcessEnv)).toThrow(
      /Shopify catalog is partly configured: missing SHOPIFY_STOREFRONT_TOKEN/,
    );
    // The API version is optional, so setting it alone configures nothing.
    expect(commerceSource({ SHOPIFY_API_VERSION: "2026-07" } as unknown as NodeJS.ProcessEnv)).toBe("mock");
  });

  it("uses Shopify when both Shopify variables are set, ahead of SFCC", () => {
    expect(
      commerceSource({
        SHOPIFY_STORE_DOMAIN: "x.myshopify.com",
        SHOPIFY_STOREFRONT_TOKEN: "t",
        SFCC_SHORT_CODE: "abc",
        SFCC_ORG_ID: "f_ecom_x_001",
        SFCC_CLIENT_ID: "id",
        SFCC_REDIRECT_URI: "https://example.com/cb",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe("shopify");
  });
});

describe("Shopify config and response mapping", () => {
  it("normalizes the store domain and defaults the API version", () => {
    const cfg = shopifyConfigFromEnv({
      SHOPIFY_STORE_DOMAIN: "https://x.myshopify.com/",
      SHOPIFY_STOREFRONT_TOKEN: "t",
    } as unknown as NodeJS.ProcessEnv);
    expect(cfg?.storeDomain).toBe("x.myshopify.com");
    expect(cfg?.apiVersion).toMatch(/^\d{4}-\d{2}$/);
  });

  it("sends private and public tokens in different headers", () => {
    expect(authHeader("shpat_abc")).toEqual({ "Shopify-Storefront-Private-Token": "shpat_abc" });
    expect(authHeader("abc123")).toEqual({ "X-Shopify-Storefront-Access-Token": "abc123" });
  });

  it("maps a product, using the handle as ID and flagging a sale", () => {
    const p = mapShopifyProduct("ridgeline", {
      handle: "trail-tent",
      title: "Trail Tent",
      availableForSale: false,
      priceRange: { minVariantPrice: { amount: "19.99", currencyCode: "CAD" } },
      compareAtPriceRange: { minVariantPrice: { amount: "29.99", currencyCode: "CAD" } },
      collections: { nodes: [{ handle: "tents" }] },
      featuredImage: { url: "https://cdn.shopify.com/s/files/1/tent.jpg", altText: "A tent\n   at dusk" },
    });
    expect(p.image).toEqual({ url: "https://cdn.shopify.com/s/files/1/tent.jpg", alt: "A tent at dusk" });
    expect(p).toMatchObject({
      id: "trail-tent",
      name: "Trail Tent",
      price: 19.99,
      currency: "CAD",
      category: "tents",
      badge: "Sale",
      inStock: false,
    });
  });

  it("maps a product with missing fields, and a collection", () => {
    const p = mapShopifyProduct("driftwood", { handle: "h1" });
    expect(p).toMatchObject({ id: "h1", name: "h1", price: 0, currency: "USD", category: "all", inStock: true });
    expect(p.badge).toBeUndefined();
    expect(p.image).toBeUndefined();
    expect(mapCollection({ handle: "tees", title: "Tees" })).toEqual({ slug: "tees", name: "Tees", description: "" });
  });
});

describe("SCAPI response mapping", () => {
  it("maps a shopper product defensively", () => {
    const p = mapProduct("ridgeline", { id: "X1", name: "Tent", price: 10, inventory: { orderable: false } });
    expect(p).toMatchObject({ id: "X1", name: "Tent", price: 10, inStock: false, brand: "ridgeline" });
  });

  it("maps a search hit with missing fields", () => {
    const p = mapHit("driftwood", { productId: "H1" }, "tees");
    expect(p).toMatchObject({ id: "H1", name: "H1", price: 0, category: "tees", inStock: true });
  });
});

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });

/** Replaces global fetch with a queue of canned responses and records the calls. */
function stubFetch(...responses: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    if (next instanceof Error) throw next;
    return next;
  });
  return calls;
}

describe("transport policy", () => {
  afterEach(() => vi.unstubAllGlobals());
  const fast = { backoffMs: 1 };

  it("retries a rate-limited request and returns the eventual success", async () => {
    const calls = stubFetch(new Response("", { status: 429 }), json({ ok: true }));
    const res = await commerceFetch("test", "https://example.com", {}, fast);
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(2);
  });

  it("retries a network error, then gives up with a typed error", async () => {
    const calls = stubFetch(new TypeError("fetch failed"), new Response("", { status: 503 }));
    await expect(commerceFetch("test", "https://example.com", {}, fast)).rejects.toMatchObject({
      name: "CommerceUpstreamError",
      status: 503,
    });
    expect(calls).toHaveLength(2);
  });

  it("does not retry client errors, so callers can handle 401 and 404", async () => {
    const calls = stubFetch(new Response("", { status: 404 }));
    expect((await commerceFetch("test", "https://example.com", {}, fast)).status).toBe(404);
    expect(calls).toHaveLength(1);
  });

  it("sets a timeout on every request", async () => {
    const calls = stubFetch(json({}));
    await commerceFetch("test", "https://example.com");
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("Shopify adapter over HTTP", () => {
  afterEach(() => vi.unstubAllGlobals());
  const client = createShopifyClient({ storeDomain: "x.myshopify.com", token: "shpat_t", apiVersion: "2026-07" });

  it("posts GraphQL to the versioned endpoint with the private-token header", async () => {
    const calls = stubFetch(json({ data: { product: { handle: "wax", title: "Wax" } } }));
    expect(await client.getProduct("ridgeline", "wax")).toMatchObject({ id: "wax", name: "Wax" });
    expect(calls[0].url).toBe("https://x.myshopify.com/api/2026-07/graphql.json");
    expect(calls[0].init.headers).toMatchObject({ "Shopify-Storefront-Private-Token": "shpat_t" });
    expect(JSON.parse(String(calls[0].init.body)).variables).toEqual({ handle: "wax" });
  });

  it("returns null for a missing product but throws on an upstream failure", async () => {
    stubFetch(json({ data: { product: null } }));
    expect(await client.getProduct("ridgeline", "nope")).toBeNull();
    stubFetch(json({ errors: [{ message: "Throttled" }] }));
    await expect(client.getProduct("ridgeline", "wax")).rejects.toBeInstanceOf(CommerceUpstreamError);
  });

  it("looks a collection up directly, and serves the catch-all without a request", async () => {
    const calls = stubFetch(json({ data: { collection: { handle: "c21", title: "Twenty-first" } } }));
    expect(await client.getCategory("ridgeline", "c21")).toEqual({ slug: "c21", name: "Twenty-first", description: "" });
    expect(await client.getCategory("ridgeline", "all")).toMatchObject({ slug: "all" });
    expect(calls).toHaveLength(1);
    stubFetch(json({ data: { collection: null } }));
    expect(await client.getCategory("ridgeline", "nope")).toBeNull();
  });

  it("keeps the price range when variants differ, and drops it when they do not", () => {
    const ranged = mapShopifyProduct("ridgeline", {
      handle: "wax",
      priceRange: {
        minVariantPrice: { amount: "9.95", currencyCode: "USD" },
        maxVariantPrice: { amount: "49.95", currencyCode: "USD" },
      },
    });
    expect(ranged).toMatchObject({ price: 9.95, priceMax: 49.95 });
    const flat = mapShopifyProduct("ridgeline", {
      handle: "board",
      priceRange: {
        minVariantPrice: { amount: "600.0", currencyCode: "USD" },
        maxVariantPrice: { amount: "600.0", currencyCode: "USD" },
      },
    });
    expect(flat.priceMax).toBeUndefined();
  });
});

describe("Shopify cart over HTTP", () => {
  afterEach(() => vi.unstubAllGlobals());
  const cart = createShopifyClient({ storeDomain: "x.myshopify.com", token: "shpat_t", apiVersion: "2026-07" }).cart!;

  const money = (amount: string) => ({ amount, currencyCode: "USD" });
  const storefrontCart = {
    id: "gid://shopify/Cart/abc?key=secret",
    checkoutUrl: "https://x.myshopify.com/cart/c/abc?key=secret",
    totalQuantity: 3,
    cost: { subtotalAmount: money("1469.91") },
    lines: {
      nodes: [
        {
          id: "line-1",
          quantity: 3,
          attribute: { value: "ridgeline" },
          cost: { totalAmount: money("1469.91"), amountPerQuantity: money("699.95") },
          merchandise: {
            title: "Ice",
            image: null,
            product: { handle: "board", title: "Board", featuredImage: { url: "https://cdn.shopify.com/b.jpg" } },
          },
        },
      ],
    },
  };

  it("creates a cart, tagging the line with its brand and sending the buyer IP", async () => {
    const calls = stubFetch(json({ data: { cartCreate: { cart: storefrontCart, userErrors: [] } } }));
    const created = await cart.createCart([{ variantId: "v1", quantity: 3, brand: "ridgeline" }], { buyerIp: "203.0.113.9" });
    expect(created).toMatchObject({
      id: "gid://shopify/Cart/abc?key=secret",
      checkoutUrl: "https://x.myshopify.com/cart/c/abc?key=secret",
      totalQuantity: 3,
      subtotal: 1469.91,
      currency: "USD",
    });
    expect(created.lines[0]).toMatchObject({
      brand: "ridgeline",
      productId: "board",
      variantTitle: "Ice",
      unitPrice: 699.95,
      lineTotal: 1469.91,
      image: { url: "https://cdn.shopify.com/b.jpg", alt: "Board" },
    });
    expect(calls[0].init.headers).toMatchObject({ "Shopify-Storefront-Buyer-IP": "203.0.113.9" });
    expect(JSON.parse(String(calls[0].init.body)).variables.input.lines).toEqual([
      { merchandiseId: "v1", quantity: 3, attributes: [{ key: "_brand", value: "ridgeline" }] },
    ]);
  });

  it("never retries a cart write, so a failed add cannot go in twice", async () => {
    const calls = stubFetch(new Response("", { status: 503 }), json({ data: {} }));
    await expect(cart.addLines("c1", [{ variantId: "v1", quantity: 1, brand: "ridgeline" }])).rejects.toBeInstanceOf(
      CommerceUpstreamError,
    );
    expect(calls).toHaveLength(1);
  });

  it("turns Shopify userErrors into a typed rejection", async () => {
    stubFetch(json({ data: { cartLinesAdd: { cart: null, userErrors: [{ code: "INVALID", message: "Variant is unavailable" }] } } }));
    await expect(cart.addLines("c1", [{ variantId: "v1", quantity: 1, brand: "ridgeline" }])).rejects.toBeInstanceOf(
      CartRejectedError,
    );
  });

  it("removes a line when the quantity is zero, and updates it otherwise", async () => {
    const calls = stubFetch(
      json({ data: { cartLinesRemove: { cart: storefrontCart, userErrors: [] } } }),
      json({ data: { cartLinesUpdate: { cart: storefrontCart, userErrors: [] } } }),
    );
    await cart.updateLine("c1", "line-1", 0);
    await cart.updateLine("c1", "line-1", 2);
    expect(JSON.parse(String(calls[0].init.body)).variables).toEqual({ cartId: "c1", lineIds: ["line-1"] });
    expect(JSON.parse(String(calls[1].init.body)).variables).toEqual({ cartId: "c1", lines: [{ id: "line-1", quantity: 2 }] });
  });

  it("returns null for an expired cart, and hides a variant title that repeats the product name", async () => {
    stubFetch(json({ data: { cart: null } }));
    expect(await cart.getCart("gone")).toBeNull();
    const single = structuredClone(storefrontCart);
    single.lines.nodes[0].merchandise.title = "Board";
    stubFetch(json({ data: { cart: single } }));
    expect((await cart.getCart("c1"))!.lines[0].variantTitle).toBe("");
  });

  it("is absent on sources without a cart", () => {
    expect(mockClient.cart).toBeUndefined();
  });
});
