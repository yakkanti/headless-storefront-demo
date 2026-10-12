import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/ProductCard";
import { BRAND_SLUGS, getBrand } from "@/lib/brands";
import { getCategories, getFeatured } from "@/lib/data";
import { categoryPath } from "@/lib/seo";

export function generateStaticParams() {
  return BRAND_SLUGS.map((brand) => ({ brand }));
}

export async function generateMetadata({ params }: PageProps<"/[brand]">): Promise<Metadata> {
  const { brand: slug } = await params;
  const brand = getBrand(slug);
  if (!brand) return {};
  return {
    title: brand.name,
    description: `${brand.name}: ${brand.tagline}.`,
    alternates: { canonical: `/${brand.slug}` },
  };
}

export default async function BrandHome({ params }: PageProps<"/[brand]">) {
  const { brand: slug } = await params;
  const brand = getBrand(slug);
  if (!brand) notFound(); // layouts and pages render in parallel, so each page validates too

  const [categories, featured] = await Promise.all([getCategories(brand.slug), getFeatured(brand.slug)]);

  return (
    <>
      <section className="hero">
        <h1>{brand.name}</h1>
        <p className="muted">{brand.tagline}</p>
      </section>

      <h2>Shop by category</h2>
      <ul className="tiles">
        {categories.map((c) => (
          <li key={c.slug} className="tile">
            <Link href={categoryPath(brand.slug, c.slug)}>
              <h3>{c.name}</h3>
            </Link>
            <p className="muted">{c.description}</p>
          </li>
        ))}
      </ul>

      <h2>Featured</h2>
      <ProductGrid products={featured} />
    </>
  );
}
