import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="container page">
      <h1>Page not found</h1>
      <p className="muted">That page does not exist in this demo.</p>
      <p>
        <Link href="/">&larr; Back to the demo</Link>
      </p>
    </main>
  );
}
