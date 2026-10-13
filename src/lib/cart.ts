import "server-only";
import { cookies, headers } from "next/headers";
import { getCommerceClient } from "./commerce";
import type { Cart, CartContext } from "./commerce/types";

/**
 * Cart session. The provider owns the cart; the browser only holds its ID in an
 * httpOnly cookie, because that ID is a bearer secret. Nothing here is cached:
 * a cart is per shopper and changes on every write.
 */

const CART_COOKIE = "cart";
/** Shopify expires a cart after about ten days without activity. */
const CART_MAX_AGE_SECONDS = 60 * 60 * 24 * 10;

export async function cartContext(): Promise<CartContext> {
  const forwarded = (await headers()).get("x-forwarded-for");
  return { buyerIp: forwarded?.split(",")[0]?.trim() || undefined };
}

export async function readCartId(): Promise<string | undefined> {
  return (await cookies()).get(CART_COOKIE)?.value;
}

/** Only callable from a Server Function or Route Handler, where cookies can be written. */
export async function writeCartId(id: string): Promise<void> {
  (await cookies()).set(CART_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_MAX_AGE_SECONDS,
  });
}

/** The shopper's cart, or null if they have none or it has expired or been checked out. */
export async function getCurrentCart(): Promise<Cart | null> {
  const client = getCommerceClient().cart;
  const id = await readCartId();
  if (!client || !id) return null;
  return client.getCart(id, await cartContext());
}
