/**
 * Provider configuration checks. Kept free of `server-only` so next.config.ts
 * can run them at startup and fail a build before anything is deployed.
 */

const PROVIDER_VARS = {
  Shopify: ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_STOREFRONT_TOKEN"],
  SFCC: ["SFCC_SHORT_CODE", "SFCC_ORG_ID", "SFCC_CLIENT_ID", "SFCC_REDIRECT_URI"],
} as const;

/**
 * A provider is either fully configured or not configured at all. Half-set
 * variables would otherwise fall through to the mock catalog and deploy a
 * working storefront full of fictional products.
 */
export function assertCommerceEnv(env: NodeJS.ProcessEnv = process.env): void {
  for (const [provider, vars] of Object.entries(PROVIDER_VARS)) {
    const missing = vars.filter((name) => !env[name]);
    if (missing.length > 0 && missing.length < vars.length) {
      throw new Error(
        `${provider} catalog is partly configured: missing ${missing.join(", ")}. ` +
          `Set all of ${vars.join(", ")}, or unset them all to use another catalog source.`,
      );
    }
  }
}
