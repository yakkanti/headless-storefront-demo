import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/commerce";
import { productPath } from "@/lib/seo";

export const money = (n: number, currency = "USD"): string => {
  // Whole amounts drop the decimals; anything else keeps the currency's own precision.
  const whole = Number.isInteger(n) ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {};
  return new Intl.NumberFormat("en-US", { style: "currency", currency, ...whole }).format(n);
};

/** "From $9.95" when variants differ in price, so the lowest price is not shown as the only one. */
export const priceLabel = (product: Pick<Product, "price" | "priceMax" | "currency">): string =>
  `${product.priceMax ? "From " : ""}${money(product.price, product.currency)}`;

export function ProductCard({ product }: { product: Product }) {
  return (
    <li className="card">
      <Link href={productPath(product.brand, product.id)} className="card-link">
        <div className="card-media">
          <Image
            src={product.image?.url ?? `/img/${product.brand}.svg`}
            alt={product.image?.alt ?? product.name}
            width={600}
            height={450}
            className={product.image ? "product-photo" : undefined}
            sizes="(min-width: 900px) 25vw, 50vw"
          />
          {product.badge ? <span className="badge">{product.badge}</span> : null}
        </div>
        <h3 className="card-title">{product.name}</h3>
        <p className="card-price">{priceLabel(product)}</p>
        {!product.inStock ? <p className="card-stock">Out of stock</p> : null}
      </Link>
    </li>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) return <p className="muted">No products found.</p>;
  return (
    <ul className="grid">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </ul>
  );
}

export function GridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="card skeleton" />
      ))}
    </ul>
  );
}
