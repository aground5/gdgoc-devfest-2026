import type { Metadata } from "next";
import Link from "next/link";
import { LiveScreen } from "@/components/live-screen";
import { MarketPanel } from "@/components/market/market-panel";
import { requireViewer } from "@/lib/auth";
import { loadFestival } from "@/lib/festival/load";
import { loadMarket } from "@/lib/festival/market";
import { RealtimeRefresh } from "@/lib/festival/realtime-refresh";

export const metadata: Metadata = {
  title: "대회 진행 · GDG DevFest 2026",
  robots: { index: false, follow: false },
};

export default async function OnFestivalPage() {
  const viewer = await requireViewer("/onfestival");

  if (!viewer.participantId) {
    return (
      <main className="grid min-h-svh place-items-center bg-page p-4 text-fg">
        <div className="max-w-md">
          <h1 className="text-2xl font-bold">참가자 계정이 아닙니다</h1>
          <p className="mt-2 text-fg/60">
            {viewer.isStaff ? "운영진 계정으로 로그인했습니다." : "등록된 참가자 정보를 찾을 수 없습니다. 운영진에게 문의해 주세요."}
          </p>
          <div className="mt-6 flex gap-2">
            {viewer.isStaff && (
              <Link href="/organize" className="bg-fg px-4 py-2 text-sm font-bold text-page">
                운영진 화면으로
              </Link>
            )}
            <form action="/auth/signout" method="post">
              <button type="submit" className="border border-fg/25 px-4 py-2 text-sm font-bold">
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  const [state, market] = await Promise.all([loadFestival(), loadMarket()]);
  const myTeamId = state.participants.find((p) => p.id === viewer.participantId)?.teamId ?? undefined;

  return (
    <>
      <LiveScreen
        state={state}
        meId={viewer.participantId}
        market={<MarketPanel state={state} entries={market} myTeamId={myTeamId} />}
      />
      <RealtimeRefresh channel={`onfestival-${viewer.participantId}`} />
    </>
  );
}
