import type { Metadata } from "next";
import { LegacyStub } from "@/components/LegacyStub";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default function AccountPage() {
  return <LegacyStub name="Account" />;
}
