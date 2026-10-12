import type { Metadata } from "next";
import { LegacyStub } from "@/components/LegacyStub";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

export default function CartPage() {
  return <LegacyStub name="Cart" />;
}
