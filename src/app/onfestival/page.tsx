import type { Metadata } from "next";
import { DbProvider } from "@/lib/db/hooks";
import { LiveScreen } from "@/components/live-screen";

export const metadata: Metadata = {
  title: "대회 진행 · GDG DevFest 2026",
};

export default function OnFestivalPage() {
  return (
    <DbProvider>
      <LiveScreen />
    </DbProvider>
  );
}
