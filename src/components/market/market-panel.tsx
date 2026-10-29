"use client";

// Participant Demo Market tab: the team's own entry editor, then every published demo to try.

import { useId, useState } from "react";
import { membersOf } from "@/lib/festival/selectors";
import type { FestivalState, MarketEntry } from "@/lib/festival/types";
import { Label, fieldCls } from "../festival-ui";
import { MarketEditor } from "./market-editor";
import { MarketCard, MarketDetail, entryTitle } from "./market-view";

export function MarketPanel({ state, entries, myTeamId }: { state: FestivalState; entries: MarketEntry[]; myTeamId?: string }) {
  const id = useId();
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const teamOf = (tid: string) => state.teams.find((t) => t.id === tid);
  const myTeam = myTeamId ? teamOf(myTeamId) : undefined;
  const mine = entries.find((e) => e.teamId === myTeamId);

  const query = q.trim().toLowerCase();
  const shown = entries
    .filter((e) => e.status === "published" && !e.hidden)
    .filter((e) => {
      const t = teamOf(e.teamId);
      return !query || [entryTitle(e, t), t?.name ?? "", t?.project ?? "", e.description].some((v) => v.toLowerCase().includes(query));
    });

  const selected = entries.find((e) => e.id === open);
  if (selected) {
    return (
      <MarketDetail
        entry={selected}
        team={teamOf(selected.teamId)}
        members={membersOf(state, selected.teamId)}
        onBack={() => setOpen(null)}
      />
    );
  }

  return (
    <div className="grid gap-10">
      {myTeam ? (
        <MarketEditor key={mine?.id ?? "new"} team={myTeam} entry={mine} />
      ) : (
        <p className="border border-fg/15 p-5 text-sm text-fg/60">팀이 배정되면 우리 팀 데모를 올릴 수 있습니다.</p>
      )}

      <section aria-labelledby={`${id}-title`}>
        <div className="flex items-baseline justify-between gap-4">
          <Label id={`${id}-title`}>데모 마켓</Label>
          <span className="tabular-nums text-xs text-fg/50">{shown.length}개 공개</span>
        </div>
        <p className="mt-2 text-sm text-fg/60">다른 팀의 서비스를 직접 써 보세요. 테스트 방법은 자세히 보기에 있습니다.</p>
        <label htmlFor={`${id}-q`} className="sr-only">
          데모 검색
        </label>
        <input
          id={`${id}-q`}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="데모, 팀명, 프로젝트 검색"
          className={`${fieldCls} mt-4`}
        />
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((e) => (
            <MarketCard
              key={e.id}
              entry={e}
              team={teamOf(e.teamId)}
              members={membersOf(state, e.teamId)}
              mine={e.teamId === myTeamId}
              onOpen={() => setOpen(e.id)}
            />
          ))}
        </ul>
        {shown.length === 0 && (
          <p className="py-6 text-sm text-fg/50">{query ? "검색 결과가 없습니다." : "아직 공개된 데모가 없습니다."}</p>
        )}
      </section>
    </div>
  );
}
