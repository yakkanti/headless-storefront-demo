import type { Metadata } from "next";
import Link from "next/link";
import migration from "../../../migration.config.json";

export const metadata: Metadata = {
  title: "Migration plan",
  description: "Route-by-route plan for an incremental, low-risk move to a headless storefront.",
};

const PRINCIPLES = [
  "Migrate by page type and by brand, lowest risk first. The business keeps selling while the frontend is rebuilt underneath it.",
  "Every cutover is reversible: routes are switched with config, so rollback is a revert, not a redeploy of the world.",
  "Old URLs keep their rankings: a permanent redirect map is tested before each cutover, and sitemaps are diffed.",
  "Core Web Vitals, analytics events and conversion are baselined first, then compared at each step. Parity or better, or it does not ship.",
  "Cart and checkout move last, behind a flag, brand by brand, and never during peak season.",
];

export default function MigrationPage() {
  return (
    <main id="main" className="container page">
      <p className="breadcrumbs">
        <Link href="/">Home</Link> / Migration plan
      </p>
      <h1>Incremental migration plan</h1>
      <p className="muted">
        Driven by <code>migration.config.json</code>. Routes marked legacy are proxied to the existing storefront when{" "}
        <code>LEGACY_ORIGIN</code> is set.
      </p>

      <h2>Principles</h2>
      <ul>
        {PRINCIPLES.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>

      <h2>Routes</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Phase</th>
              <th>Route</th>
              <th>Pattern</th>
              <th>Status</th>
              <th>Risk</th>
              <th>Guardrail</th>
            </tr>
          </thead>
          <tbody>
            {migration.routes.map((r) => (
              <tr key={r.name}>
                <td>{r.phase}</td>
                <th scope="row">{r.name}</th>
                <td>
                  <code>{r.pattern}</code>
                </td>
                <td>
                  <span className={`pill ${r.status}`}>{r.status}</span>
                </td>
                <td>{r.risk}</td>
                <td>{r.guardrail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
