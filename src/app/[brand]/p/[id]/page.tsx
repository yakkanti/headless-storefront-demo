import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { priceLabel } from "@/components/ProductCard";
import { BRAND_SLUGS, getBrand } from "@/lib/brands";
import { getProduct, listProducts } from "@/lib/data";
import { categoryPath, productJsonLd, productPath } from "@/lib/seo";

/** Prerender every product in the active catalog. Unknown ones render on demand and 404 if absent. */
export async function generateStaticParams() {
  const perBrand = await Promise.all(
    BRAND_SLUGS.map(async (brand) => (await listProducts(brand)).map((p) => ({ brand, id: p.id }))),
  );
  const params = perBrand.flat();
  // Cache Components rejects an empty list at build time; an empty catalog gets one param that 404s.
  return params.length > 0 ? params : [{ brand: BRAND_SLUGS[0], id: "__none__" }];
}

export async function generateMetadata({ params }: PageProps<"/[brand]/p/[id]">): Promise<Metadata> {
  const { brand: slug, id } = await params;
  const brand = getBrand(slug);
  if (!brand) return {};
  const product = await getProduct(brand.slug, id);
  if (!product) return { robots: { index: false } };
  return {
    title: `${product.name} | ${brand.name}`,
    description: product.description,
    alternates: { canonical: productPath(brand.slug, product.id) },
    openGraph: { title: product.name, description: product.description, type: "website" },
  };
}

export default async function ProductPage({ params }: PageProps<"/[brand]/p/[id]">) {
  const { brand: slug, id } = await params;
  const brand = getBrand(slug);
  if (!brand) notFound(); // layouts and pages render in parallel, so each page validates too

  const product = await getProduct(brand.slug, id);
  if (!product) notFound(); // before streaming, so the response is a true 404

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd(product) }} />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href={`/${brand.slug}`}>{brand.name}</Link> /{" "}
        <Link href={categoryPath(brand.slug, product.category)}>{product.category}</Link> / {product.name}
      </nav>
      <div className="pdp">
        {/* The hero image is the likely LCP element, so it loads with priority. */}
        <Image
          src={product.image?.url ?? `/img/${brand.slug}.svg`}
          alt={product.image?.alt ?? product.name}
          width={600}
          height={450}
          className={product.image ? "product-photo" : undefined}
          priority
          sizes="(min-width: 800px) 55vw, 100vw"
        />
        <div>
          <h1>{product.name}</h1>
          <p className="pdp-price">{priceLabel(product)}</p>
          <p>{product.description}</p>
          <p className="muted">SKU {product.id}</p>
          <span className="button" aria-disabled="true" role="button">
            {product.inStock ? "Add to cart (demo)" : "Out of stock"}
          </span>
          <p className="note">
            Cart and checkout are still served by the legacy platform in this plan, so the riskiest, revenue-critical
            flow does not change until the end. See the <Link href="/migration">migration plan</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
