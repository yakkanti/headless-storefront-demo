import Link from "next/link";

/**
 * Stand-in for routes that stay on the legacy platform during the migration.
 * With LEGACY_ORIGIN set, requests to these paths are proxied to the real
 * legacy storefront (see next.config.ts) and this page is never shown.
 */
export function LegacyStub({ name }: { name: string }) {
  return (
    <main id="main" className="container page">
      <h1>{name}</h1>
      <p className="note">
        In this plan, {name.toLowerCase()} is still served by the legacy Salesforce Commerce Cloud storefront. It
        moves in a later phase, behind a flag, and not during peak season. See the{" "}
        <Link href="/migration">migration plan</Link>.
      </p>
      <p>
        <Link href="/">&larr; Back to the demo</Link>
      </p>
    </main>
  );
}
