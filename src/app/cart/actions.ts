"use server";

import { redirect } from "next/navigation";
import { isBrandSlug } from "@/lib/brands";
import { cartContext, readCartId, writeCartId } from "@/lib/cart";
import { CartRejectedError, getCommerceClient } from "@/lib/commerce";

const MAX_QUANTITY = 99;

/** Fixed codes, not provider text, go into the URL so the cart page cannot be made to display arbitrary messages. */
export type CartErrorCode = "unavailable" | "failed";

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" && value.length > 0 && value.length <= 300 ? value : null;
};

const quantity = (form: FormData, min: number) => {
  const n = Number(form.get("quantity"));
  return Number.isInteger(n) && n >= min && n <= MAX_QUANTITY ? n : null;
};

/** Runs a cart write and sends the shopper to the cart, with an error code if the provider refused it. */
async function run(write: () => Promise<void>): Promise<never> {
  let error: CartErrorCode | null = null;
  try {
    await write();
  } catch (e) {
    if (!(e instanceof CartRejectedError)) throw e; // upstream outage: let the error page offer a retry
    error = "unavailable";
  }
  redirect(error ? `/cart?error=${error}` : "/cart");
}

export async function addToCart(form: FormData): Promise<void> {
  const client = getCommerceClient().cart;
  const variantId = text(form, "variantId");
  const brand = text(form, "brand");
  const qty = quantity(form, 1);
  if (!client || !variantId || !brand || !isBrandSlug(brand) || !qty) redirect("/cart?error=failed");

  await run(async () => {
    const ctx = await cartContext();
    const lines = [{ variantId, quantity: qty, brand }];
    const id = await readCartId();
    // An expired or checked-out cart cannot be added to, so start a new one.
    const existing = id ? await client.getCart(id, ctx) : null;
    const cart = existing ? await client.addLines(existing.id, lines, ctx) : await client.createCart(lines, ctx);
    await writeCartId(cart.id);
  });
}

/** Quantity 0 removes the line. */
export async function updateCartLine(form: FormData): Promise<void> {
  const client = getCommerceClient().cart;
  const lineId = text(form, "lineId");
  const qty = quantity(form, 0);
  const id = await readCartId();
  if (!client || !lineId || qty === null || !id) redirect("/cart?error=failed");

  await run(async () => {
    await client.updateLine(id, lineId, qty, await cartContext());
  });
}
