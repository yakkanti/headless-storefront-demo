import type { Metadata } from "next";
import { LegacyStub } from "@/components/LegacyStub";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return <LegacyStub name="Checkout" />;
}
