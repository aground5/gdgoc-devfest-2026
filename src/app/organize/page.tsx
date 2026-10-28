import type { Metadata } from "next";
import { AdminScreen } from "@/components/admin-screen";

export const metadata: Metadata = {
  title: "운영진 · GDG DevFest 2026",
  robots: { index: false, follow: false },
};

export default function OrganizePage() {
  return <AdminScreen />;
}
