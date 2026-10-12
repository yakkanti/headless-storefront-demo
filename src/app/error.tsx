"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";

/**
 * Shown when a page or the brand layout fails to load, for example when the
 * catalog provider is down and nothing is cached yet. Retrying re-fetches.
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="container page">
      <h1>We could not load this page</h1>
      <p className="muted">The catalog did not respond. This is usually temporary.</p>
      <p>
        <button type="button" className="button" onClick={() => retry()}>
          Try again
        </button>
      </p>
      <p>
        <Link href="/">&larr; Back to the demo</Link>
      </p>
    </main>
  );
}
