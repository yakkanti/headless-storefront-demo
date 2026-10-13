import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LegacyStub } from "@/components/LegacyStub";
import { getCurrentCart } from "@/lib/cart";
import { cartSupported } from "@/lib/commerce";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  // Sources without a cart leave purchasing on the legacy platform.
  if (!cartSupported()) return <LegacyStub name="Checkout" />;

  return (
    <main id="main" className="container page">
      <Suspense fallback={<p className="muted">Taking you to secure checkout…</p>}>
        <CheckoutHandoff />
      </Suspense>
    </main>
  );
}

/**
 * Payment is never handled here. The shopper is handed to the provider's hosted
 * checkout for their cart, which keeps card data and PCI scope off this app.
 */
async function CheckoutHandoff(): Promise<never> {
  const cart = await getCurrentCart();
  redirect(cart && cart.lines.length > 0 ? cart.checkoutUrl : "/cart");
}
