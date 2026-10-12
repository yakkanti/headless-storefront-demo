import { describe, expect, it } from "vitest";
import { priceLabel } from "@/components/ProductCard";
import { expandTags } from "@/lib/cache-tags";
import { legacyToNew, productJsonLd } from "@/lib/seo";
import { mockClient } from "@/lib/commerce/mock";

describe("legacyToNew (301 map for SEO parity)", () => {
  it("maps legacy product URLs to the new PDP", () => {
    expect(legacyToNew("/ridgeline/product/basecamp-tent/RL-1001.html")).toBe("/ridgeline/p/RL-1001");
  });

  it("maps legacy category URLs to the new PLP", () => {
    expect(legacyToNew("/tidewater/category/safety")).toBe("/tidewater/c/safety");
  });

  it("tolerates trailing slashes", () => {
    expect(legacyToNew("/driftwood/category/tees/")).toBe("/driftwood/c/tees");
  });

  it("returns null for unknown brands and non-legacy paths", () => {
    expect(legacyToNew("/unknown/product/x/1.html")).toBeNull();
    expect(legacyToNew("/ridgeline/p/RL-1001")).toBeNull();
    expect(legacyToNew("/ridgeline/product/x/1")).toBeNull();
  });
});

describe("productJsonLd", () => {
  it("emits schema.org Product markup and escapes angle brackets", async () => {
    const product = await mockClient.getProduct("ridgeline", "RL-1001");
    expect(product).not.toBeNull();
    const json = productJsonLd({ ...product!, name: "</script><b>x" });
    expect(json).not.toContain("<");
    const parsed = JSON.parse(json);
    expect(parsed["@type"]).toBe("Product");
    expect(parsed.offers.priceCurrency).toBe("USD");
  });
});

describe("productJsonLd price", () => {
  it("emits a single Offer, or an AggregateOffer when variants differ in price", async () => {
    const product = (await mockClient.getProduct("ridgeline", "RL-1001"))!;
    expect(JSON.parse(productJsonLd(product)).offers).toMatchObject({ "@type": "Offer", price: "289.00" });
    expect(JSON.parse(productJsonLd({ ...product, price: 9.95, priceMax: 49.95 })).offers).toMatchObject({
      "@type": "AggregateOffer",
      lowPrice: "9.95",
      highPrice: "49.95",
    });
  });
});

describe("expandTags (cache invalidation fan-out)", () => {
  it("purges the brand catalog along with a product, so listings do not keep a stale price", () => {
    expect(expandTags(["product:ridgeline:RL-1001"], false)).toEqual(["product:ridgeline:RL-1001", "catalog:ridgeline"]);
  });

  it("purges every brand when one catalog backs them all", () => {
    expect(expandTags(["product:ridgeline:wax"], true).sort()).toEqual(
      ["catalog:driftwood", "catalog:ridgeline", "catalog:tidewater", "product:ridgeline:wax"].sort(),
    );
  });

  it("leaves tags without a known brand alone, and does not duplicate", () => {
    expect(expandTags(["something-else", "catalog:tidewater"], false)).toEqual(["something-else", "catalog:tidewater"]);
  });
});

describe("priceLabel", () => {
  it("shows a single price, or the lowest with From when variants differ", () => {
    expect(priceLabel({ price: 600, currency: "USD" })).toBe("$600");
    expect(priceLabel({ price: 9.95, priceMax: 49.95, currency: "USD" })).toBe("From $9.95");
  });
});
