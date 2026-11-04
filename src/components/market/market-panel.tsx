"use client";

// Participant Demo Market tab: the team's own entry editor, then every published demo to try.
// A judge (심사위원) has no team: instead of the editor they get their progress
// (which demos they've invested in) and the judging criteria.

import { useId, useState } from "react";
import type { DemoEntry } from "@/lib/db/queries";
import { membersOf, won, type FestivalState } from "@/lib/festival-store";
import { JudgingCriteria, Label, RankBar, btn, field } from "../festival-ui";
import { MarketEditor } from "./market-editor";
import { MarketCard, MarketDetail, entryTitle } from "./market-view";

export function MarketPanel({
  state,
  entries,
  myTeamId,
  judgeId,
  onInvest,
}: {
  state: FestivalState;
  entries: DemoEntry[];
  myTeamId?: string;
  judgeId?: string;
  onInvest?: () => void;
}) {
  const id = useId();
  const [open, setOpenState] = useState<string | null>(null);
  // Detail and list have very different heights; start each at the top
  const setOpen = (id: string | null) => {
    setOpenState(id);
    window.scrollTo({ top: 0 });
  };
  const [q, setQ] = useState("");
  const [onlyTodo, setOnlyTodo] = useState(false);
  const mineInv = judgeId ? (state.investments[judgeId] ?? {}) : {};
  const investedIn = (tid: string) => (mineInv[tid] ?? 0) > 0;
  const teamOf = (tid: string) => state.teams.find((t) => t.id === tid);
  const myTeam = myTeamId ? teamOf(myTeamId) : undefined;
  const mine = entries.find((e) => e.teamId === myTeamId);

  const query = q.trim().toLowerCase();
  const published = entries.filter((e) => e.status === "published" && !e.hidden);
  const done = published.filter((e) => investedIn(e.teamId)).length;
  const shown = published
    .filter((e) => !judgeId || !onlyTodo || !investedIn(e.teamId))
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
        actions={
          judgeId && onInvest ? (
            <span className="flex flex-wrap items-center gap-3">
              <span className="tabular-nums text-sm text-subtle">
                {investedIn(selected.teamId) ? `내 투자 ${won(mineInv[selected.teamId])}` : "아직 투자하지 않았습니다"}
              </span>
              <button type="button" onClick={onInvest} className={btn("primary")}>
                투자하러 가기
              </button>
            </span>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-10">
      {judgeId ? (
        <div className="grid grid-cols-1 gap-4">
          <section aria-labelledby={`${id}-judge`} className="border border-fg/15 bg-surface p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Label id={`${id}-judge`}>심사위원</Label>
                <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">
                  공개 데모 {published.length}개 중 {done}개에 투자
                </p>
                <p className="mt-1 text-sm text-subtle">모든 팀의 데모를 직접 써 보고, 투자 탭에서 평가해 주세요.</p>
              </div>
              {onInvest && (
                <button type="button" onClick={onInvest} className={btn("secondary")}>
                  투자 탭으로
                </button>
              )}
            </div>
            <div className="mt-4">
              <RankBar value={done} max={published.length} />
            </div>
          </section>
          <JudgingCriteria />
        </div>
      ) : myTeam ? (
        <MarketEditor key={mine?.id ?? "new"} team={myTeam} entry={mine} />
      ) : (
        <p className="border border-fg/15 p-5 text-sm text-subtle">팀이 배정되면 우리 팀 데모를 올릴 수 있습니다.</p>
      )}

      <section aria-labelledby={`${id}-title`}>
        <div className="flex items-baseline justify-between gap-4">
          <Label id={`${id}-title`}>데모 마켓</Label>
          <span className="tabular-nums text-xs text-subtle">{published.length}개 공개</span>
        </div>
        <p className="mt-2 text-sm text-subtle">다른 팀의 서비스를 직접 써 보세요. 테스트 방법은 자세히 보기에 있습니다.</p>
        <label htmlFor={`${id}-q`} className="sr-only">
          데모 검색
        </label>
        <input
          id={`${id}-q`}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="데모, 팀명, 프로젝트 검색"
          className={`${field()} mt-4 w-full`}
        />
        {judgeId && (
          <div className="mt-3 flex gap-1" role="group" aria-label="데모 필터">
            {(
              [
                [false, "전체"],
                [true, "아직 투자 안 함"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={l}
                type="button"
                aria-pressed={onlyTodo === v}
                onClick={() => setOnlyTodo(v)}
                className={btn(onlyTodo === v ? "primary" : "secondary", "sm")}
              >
                {l}
              </button>
            ))}
          </div>
        )}
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((e) => (
            <MarketCard
              key={e.id}
              entry={e}
              team={teamOf(e.teamId)}
              members={membersOf(state, e.teamId)}
              mine={e.teamId === myTeamId}
              onOpen={() => setOpen(e.id)}
              note={
                judgeId ? (
                  investedIn(e.teamId) ? (
                    <span className="flex items-center gap-2 font-bold tabular-nums">
                      <span className="h-1.5 w-1.5 bg-ok" aria-hidden="true" />내 투자 {won(mineInv[e.teamId])}
                    </span>
                  ) : (
                    <span className="text-subtle">아직 투자하지 않음</span>
                  )
                ) : undefined
              }
            />
          ))}
        </ul>
        {shown.length === 0 && (
          <p className="py-6 text-sm text-subtle">
            {query
              ? "검색 결과가 없습니다."
              : onlyTodo && published.length > 0
                ? "공개된 모든 데모에 투자했습니다."
                : "아직 공개된 데모가 없습니다."}
          </p>
        )}
      </section>
    </div>
  );
}
