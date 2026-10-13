import { addToCart } from "@/app/cart/actions";
import type { BrandSlug } from "@/lib/brands";
import type { Product } from "@/lib/commerce";
import { money } from "./ProductCard";

/**
 * A plain form posting to a Server Function, so adding to the cart works
 * without client-side JavaScript and from a fully prerendered product page.
 */
export function AddToCart({ brand, product }: { brand: BrandSlug; product: Product }) {
  const variants = product.variants ?? [];
  const firstAvailable = variants.find((v) => v.available);
  if (!firstAvailable) {
    return (
      <span className="button" aria-disabled="true" role="button">
        Out of stock
      </span>
    );
  }

  return (
    <form action={addToCart} className="add-to-cart">
      <input type="hidden" name="brand" value={brand} />
      {variants.length > 1 ? (
        <label>
          Option
          <select name="variantId" defaultValue={firstAvailable.id}>
            {variants.map((v) => (
              <option key={v.id} value={v.id} disabled={!v.available}>
                {v.title} · {money(v.price, product.currency)}
                {v.available ? "" : " (out of stock)"}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="variantId" value={firstAvailable.id} />
      )}
      <label>
        Quantity
        <input type="number" name="quantity" defaultValue={1} min={1} max={99} required />
      </label>
      <button type="submit" className="button">
        Add to cart
      </button>
    </form>
  );
}
