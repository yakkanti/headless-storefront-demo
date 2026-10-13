import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { LegacyStub } from "@/components/LegacyStub";
import { money } from "@/components/ProductCard";
import { getCurrentCart } from "@/lib/cart";
import { cartSupported } from "@/lib/commerce";
import { productPath } from "@/lib/seo";
import { type CartErrorCode, updateCartLine } from "./actions";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

const ERRORS: Record<CartErrorCode, string> = {
  unavailable: "That item could not be added. It may be out of stock or sold only as a subscription.",
  failed: "The cart could not be updated. Please try again.",
};

export default function CartPage({ searchParams }: PageProps<"/cart">) {
  // Sources without a cart leave purchasing on the legacy platform.
  if (!cartSupported()) return <LegacyStub name="Cart" />;

  return (
    <main id="main" className="container page">
      <h1>Cart</h1>
      {/* The cart is per shopper, so it renders at request time behind the static shell. */}
      <Suspense fallback={<p className="muted">Loading your cart…</p>}>
        <CartContents searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function CartContents({ searchParams }: Pick<PageProps<"/cart">, "searchParams">) {
  const { error } = await searchParams;
  const message = typeof error === "string" && error in ERRORS ? ERRORS[error as CartErrorCode] : null;
  const cart = await getCurrentCart();

  return (
    <>
      {message ? (
        <p className="note" role="alert">
          {message}
        </p>
      ) : null}
      {!cart || cart.lines.length === 0 ? (
        <>
          <p className="muted">Your cart is empty.</p>
          <p>
            <Link href="/">&larr; Continue shopping</Link>
          </p>
        </>
      ) : (
        <>
          <ul className="cart-lines">
            {cart.lines.map((line) => (
              <li key={line.id} className="cart-line">
                {line.image ? (
                  <Image src={line.image.url} alt={line.image.alt} width={96} height={96} className="cart-thumb" />
                ) : null}
                <div className="cart-line-info">
                  {line.brand ? (
                    <Link href={productPath(line.brand, line.productId)}>{line.name}</Link>
                  ) : (
                    <span>{line.name}</span>
                  )}
                  {line.variantTitle ? <p className="muted">{line.variantTitle}</p> : null}
                  <p className="muted">{money(line.unitPrice, cart.currency)} each</p>
                </div>
                <form action={updateCartLine} className="cart-quantity">
                  <input type="hidden" name="lineId" value={line.id} />
                  <input
                    type="number"
                    name="quantity"
                    defaultValue={line.quantity}
                    min={0}
                    max={99}
                    aria-label={`Quantity of ${line.name}`}
                    required
                  />
                  <button type="submit" className="button">
                    Update
                  </button>
                </form>
                <form action={updateCartLine}>
                  <input type="hidden" name="lineId" value={line.id} />
                  <input type="hidden" name="quantity" value={0} />
                  <button type="submit" className="link-button" aria-label={`Remove ${line.name}`}>
                    Remove
                  </button>
                </form>
                <p className="cart-line-total">
                  {money(line.lineTotal, cart.currency)}
                  {/* The provider applies automatic discounts to the line total, not the unit price. */}
                  {line.lineTotal < line.unitPrice * line.quantity - 0.005 ? (
                    <span className="cart-discount">Discount applied</span>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
          <div className="cart-summary">
            <p>
              Subtotal ({cart.totalQuantity} {cart.totalQuantity === 1 ? "item" : "items"}):{" "}
              <strong>{money(cart.subtotal, cart.currency)}</strong>
            </p>
            <p className="muted">Shipping and taxes are calculated at checkout.</p>
            <p>
              <Link href="/checkout" className="button" prefetch={false}>
                Checkout
              </Link>
            </p>
            <p>
              <Link href="/">&larr; Continue shopping</Link>
            </p>
          </div>
        </>
      )}
    </>
  );
}
