import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { BRANDS, type BrandSlug } from "../brands";
import { CommerceUpstreamError, commerceFetch } from "./http";
import type { Category, CommerceClient, Product } from "./types";

/**
 * Salesforce Commerce Cloud (B2C) Shopper API client, written to the documented
 * SLAS guest-token flow and the shopper-products / shopper-search endpoints.
 *
 * STATUS: not exercised against a live realm. This repo has no sandbox, so this
 * adapter is a reference implementation of the integration pattern. Validate it
 * against a real SFCC instance before relying on it. The storefront defaults to
 * the mock catalog unless every SFCC_* variable below is set.
 */

export type ScapiConfig = {
  shortCode: string;
  organizationId: string; // e.g. f_ecom_zzxx_001
  clientId: string; // SLAS public client
  redirectUri: string;
};

export function scapiConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ScapiConfig | null {
  const { SFCC_SHORT_CODE, SFCC_ORG_ID, SFCC_CLIENT_ID, SFCC_REDIRECT_URI } = env;
  if (!SFCC_SHORT_CODE || !SFCC_ORG_ID || !SFCC_CLIENT_ID || !SFCC_REDIRECT_URI) return null;
  return {
    shortCode: SFCC_SHORT_CODE,
    organizationId: SFCC_ORG_ID,
    clientId: SFCC_CLIENT_ID,
    redirectUri: SFCC_REDIRECT_URI,
  };
}

type Token = { accessToken: string; expiresAt: number };
const tokenCache = new Map<string, Token>();

const b64url = (buf: Buffer) => buf.toString("base64url");

async function guestToken(cfg: ScapiConfig, siteId: string): Promise<string> {
  const cached = tokenCache.get(siteId);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.accessToken;

  const base = `https://${cfg.shortCode}.api.commercecloud.salesforce.com/shopper/auth/v1/organizations/${cfg.organizationId}/oauth2`;
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());

  const authorize = new URL(`${base}/authorize`);
  authorize.search = new URLSearchParams({
    client_id: cfg.clientId,
    channel_id: siteId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    hint: "guest",
    code_challenge: challenge,
  }).toString();

  // The authorize call answers with a redirect that carries the auth code.
  // The auth code is single-use, so neither step of the exchange is retried.
  const redirect = await commerceFetch("SLAS authorize", authorize, { redirect: "manual" }, { retries: 0 });
  const location = redirect.headers.get("location");
  const code = location ? new URL(location, cfg.redirectUri).searchParams.get("code") : null;
  if (!code) throw new CommerceUpstreamError(`SLAS authorize returned no code (status ${redirect.status})`, redirect.status);

  const res = await commerceFetch(
    "SLAS token",
    `${base}/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code_pkce",
        code,
        code_verifier: verifier,
        client_id: cfg.clientId,
        channel_id: siteId,
        redirect_uri: cfg.redirectUri,
      }),
    },
    { retries: 0 },
  );
  if (!res.ok) throw new CommerceUpstreamError(`SLAS token request failed (${res.status})`, res.status);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache.set(siteId, {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  });
  return json.access_token;
}

type ShopperProduct = {
  id: string;
  name?: string;
  price?: number;
  currency?: string;
  shortDescription?: string;
  longDescription?: string;
  primaryCategoryId?: string;
  inventory?: { orderable?: boolean };
};

type SearchHit = {
  productId: string;
  productName?: string;
  price?: number;
  currency?: string;
  orderable?: boolean;
};

export function mapProduct(brand: BrandSlug, p: ShopperProduct, fallbackCategory = "all"): Product {
  return {
    id: p.id,
    brand,
    category: p.primaryCategoryId ?? fallbackCategory,
    name: p.name ?? p.id,
    price: p.price ?? 0,
    currency: p.currency ?? "USD",
    description: p.shortDescription ?? p.longDescription ?? "",
    inStock: p.inventory?.orderable ?? true,
  };
}

export function mapHit(brand: BrandSlug, hit: SearchHit, category: string): Product {
  return {
    id: hit.productId,
    brand,
    category,
    name: hit.productName ?? hit.productId,
    price: hit.price ?? 0,
    currency: hit.currency ?? "USD",
    description: "",
    inStock: hit.orderable ?? true,
  };
}

export function createScapiClient(cfg: ScapiConfig): CommerceClient {
  const api = `https://${cfg.shortCode}.api.commercecloud.salesforce.com`;
  const org = cfg.organizationId;

  async function get<T>(brand: BrandSlug, path: string, params: Record<string, string> = {}): Promise<T> {
    const siteId = BRANDS[brand].sfccSiteId;
    const url = new URL(`${api}${path}`);
    url.search = new URLSearchParams({ siteId, ...params }).toString();
    const send = async () =>
      commerceFetch(`SCAPI ${path}`, url, { headers: { Authorization: `Bearer ${await guestToken(cfg, siteId)}` } });

    let res = await send();
    if (res.status === 401) {
      // The cached guest token was rejected (expired or revoked): fetch a new one and try once more.
      tokenCache.delete(siteId);
      res = await send();
    }
    if (res.status === 404) throw new CommerceUpstreamError("not found", 404);
    if (!res.ok) throw new CommerceUpstreamError(`SCAPI ${path} failed (${res.status})`, res.status);
    return (await res.json()) as T;
  }

  async function search(brand: BrandSlug, params: Record<string, string>, category: string) {
    const json = await get<{ hits?: SearchHit[] }>(
      brand,
      `/search/shopper-search/v1/organizations/${org}/product-search`,
      { limit: "24", ...params },
    );
    return (json.hits ?? []).map((h) => mapHit(brand, h, category));
  }

  return {
    async getCategories(brand) {
      const json = await get<{ categories?: { id: string; name?: string; pageDescription?: string }[] }>(
        brand,
        `/product/shopper-products/v1/organizations/${org}/categories/root`,
        { levels: "1" },
      );
      return (json.categories ?? []).map(
        (c): Category => ({ slug: c.id, name: c.name ?? c.id, description: c.pageDescription ?? "" }),
      );
    },
    async getCategory(brand, slug) {
      try {
        const c = await get<{ id: string; name?: string; pageDescription?: string }>(
          brand,
          `/product/shopper-products/v1/organizations/${org}/categories/${encodeURIComponent(slug)}`,
        );
        return { slug: c.id, name: c.name ?? c.id, description: c.pageDescription ?? "" };
      } catch (e) {
        if ((e as { status?: number }).status === 404) return null;
        throw e;
      }
    },
    getFeatured: (brand) => search(brand, { q: "", sort: "best-matches" }, "featured"),
    listProducts: (brand) => search(brand, { q: "", limit: "200" }, "all"),
    getProductsByCategory: (brand, category) => search(brand, { refine: `cgid=${category}` }, category),
    async getProduct(brand, id) {
      try {
        const p = await get<ShopperProduct>(brand, `/product/shopper-products/v1/organizations/${org}/products/${id}`);
        return mapProduct(brand, p);
      } catch (e) {
        if ((e as { status?: number }).status === 404) return null;
        throw e;
      }
    },
    searchProducts: (brand, query) => search(brand, { q: query }, "search"),
  };
}
