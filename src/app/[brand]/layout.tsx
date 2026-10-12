import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { BRAND_SLUGS, getBrand } from "@/lib/brands";
import { getCategories } from "@/lib/data";
import { categoryPath } from "@/lib/seo";

export function generateStaticParams() {
  return BRAND_SLUGS.map((brand) => ({ brand }));
}

export default async function BrandLayout({ params, children }: LayoutProps<"/[brand]">) {
  // Validate the brand before anything streams, so an unknown brand returns a
  // real 404 status instead of a 200 "soft 404" that search engines would index.
  const { brand: slug } = await params;
  const brand = getBrand(slug);
  if (!brand) notFound();

  const categories = await getCategories(brand.slug);
  const theme = { "--brand": brand.color, "--brand-dark": brand.colorDark } as CSSProperties;

  return (
    <div className="brand-shell" style={theme}>
      <header className="brand-header">
        <div className="container">
          <Link href={`/${brand.slug}`} className="brand-name">
            {brand.name}
          </Link>
          <nav className="brand-nav" aria-label="Categories">
            {categories.map((c) => (
              <Link key={c.slug} href={categoryPath(brand.slug, c.slug)}>
                {c.name}
              </Link>
            ))}
          </nav>
          {/* Plain GET form: works without JavaScript and keeps search URLs shareable. */}
          <form action={`/${brand.slug}/search`} role="search" className="search-form">
            <input type="search" name="q" placeholder="Search" aria-label={`Search ${brand.name}`} required />
            <button type="submit">Search</button>
          </form>
        </div>
      </header>
      <main id="main" className="container">
        {children}
      </main>
      <footer className="brand-footer">
        <div className="container">
          <p>
            {brand.name} is a fictional brand in a portfolio demo. <Link href="/">All brands</Link> ·{" "}
            <Link href="/migration">Migration plan</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
