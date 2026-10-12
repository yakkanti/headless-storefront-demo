import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GridSkeleton, ProductGrid } from "@/components/ProductCard";
import { BRAND_SLUGS, getBrand } from "@/lib/brands";
import { searchProducts } from "@/lib/data";

export function generateStaticParams() {
  return BRAND_SLUGS.map((brand) => ({ brand }));
}

// Search result pages are thin, near-infinite URLs: keep them out of the index.
export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

export default function SearchPage(props: PageProps<"/[brand]/search">) {
  // searchParams is request-time data, so it stays inside Suspense. The shell is
  // static and the results stream in.
  return (
    <>
      <h1>Search</h1>
      <Suspense fallback={<GridSkeleton />}>
        <Results params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Results({
  params,
  searchParams,
}: {
  params: Promise<{ brand: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { brand: slug } = await params;
  const brand = getBrand(slug);
  if (!brand) notFound();

  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 80).trim() ?? "";
  if (!query) return <p className="muted">Enter a search term above.</p>;

  const results = await searchProducts(brand.slug, query);
  return (
    <>
      <p className="muted" role="status">
        {results.length} result{results.length === 1 ? "" : "s"} for &ldquo;{query}&rdquo;
      </p>
      <ProductGrid products={results} />
    </>
  );
}
