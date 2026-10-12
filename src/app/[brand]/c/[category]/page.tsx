import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/ProductCard";
import { BRAND_SLUGS, getBrand } from "@/lib/brands";
import { getCategories, getCategory, getProductsByCategory } from "@/lib/data";
import { categoryPath } from "@/lib/seo";

/** Prerender every known category. Unknown ones render on demand and 404 if absent. */
export async function generateStaticParams() {
  const perBrand = await Promise.all(
    BRAND_SLUGS.map(async (brand) => (await getCategories(brand)).map((c) => ({ brand, category: c.slug }))),
  );
  const params = perBrand.flat();
  // Cache Components rejects an empty list at build time; an empty catalog gets one param that 404s.
  return params.length > 0 ? params : [{ brand: BRAND_SLUGS[0], category: "__none__" }];
}

export async function generateMetadata({ params }: PageProps<"/[brand]/c/[category]">): Promise<Metadata> {
  const { brand: slug, category } = await params;
  const brand = getBrand(slug);
  if (!brand) return {};
  const match = await getCategory(brand.slug, category);
  if (!match) return { robots: { index: false } };
  return {
    title: `${match.name} | ${brand.name}`,
    description: match.description,
    alternates: { canonical: categoryPath(brand.slug, match.slug) },
  };
}

export default async function CategoryPage({ params }: PageProps<"/[brand]/c/[category]">) {
  const { brand: slug, category } = await params;
  const brand = getBrand(slug);
  if (!brand) notFound(); // layouts and pages render in parallel, so each page validates too

  const current = await getCategory(brand.slug, category);
  if (!current) notFound(); // before streaming, so the response is a true 404

  const products = await getProductsByCategory(brand.slug, category);

  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href={`/${brand.slug}`}>{brand.name}</Link> / {current.name}
      </nav>
      <h1>{current.name}</h1>
      <p className="muted">{current.description}</p>
      <ProductGrid products={products} />
    </>
  );
}
