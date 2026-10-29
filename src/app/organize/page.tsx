import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminScreen } from "@/components/admin-screen";
import { MarketModeration } from "@/components/market/market-moderation";
import { requireViewer } from "@/lib/auth";
import { loadFestival, loadStaffExtras } from "@/lib/festival/load";
import { loadMarket } from "@/lib/festival/market";
import { RealtimeRefresh } from "@/lib/festival/realtime-refresh";

export const metadata: Metadata = {
  title: "운영진 · GDG DevFest 2026",
  robots: { index: false, follow: false },
};

export default async function OrganizePage() {
  const viewer = await requireViewer("/organize");
  if (!viewer.isStaff) notFound();

  const [state, extras, market] = await Promise.all([loadFestival(), loadStaffExtras(), loadMarket()]);

  return (
    <>
      <AdminScreen
        state={state}
        extras={extras}
        who={viewer.email}
        market={<MarketModeration state={state} entries={market} />}
      />
      <RealtimeRefresh channel={`organize-${viewer.userId}`} />
    </>
  );
}
