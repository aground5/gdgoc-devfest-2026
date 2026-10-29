"use client";

// Staff Demo Market tab: every entry, drafts included, with hide/unhide and delete.

import { useId, useState, useTransition } from "react";
import { deleteEntry, setEntryHidden } from "@/app/onfestival/market/actions";
import { membersOf, timeLabel } from "@/lib/festival/selectors";
import type { FestivalState, MarketEntry } from "@/lib/festival/types";
import { Label, fieldCls, primaryBtn, smallBtn } from "../festival-ui";
import { MarketCard, MarketDetail, StatusChip, entryTitle } from "./market-view";

export function MarketModeration({ state, entries }: { state: FestivalState; entries: MarketEntry[] }) {
  const id = useId();
  const [open, setOpen] = useState<string | null>(null);
  const teamOf = (tid: string) => state.teams.find((t) => t.id === tid);
  const published = entries.filter((e) => e.status === "published").length;
  const without = state.teams.filter((t) => !entries.some((e) => e.teamId === t.id));

  const selected = entries.find((e) => e.id === open);
  if (selected) {
    return (
      <MarketDetail
        entry={selected}
        team={teamOf(selected.teamId)}
        members={membersOf(state, selected.teamId)}
        onBack={() => setOpen(null)}
        actions={<Moderate entry={selected} onDeleted={() => setOpen(null)} />}
      />
    );
  }

  return (
    <div className="grid gap-8">
      <dl className="grid grid-cols-3 gap-px border border-fg/10 bg-fg/10">
        {[
          ["공개", `${published}팀`],
          ["초안", `${entries.length - published}팀`],
          ["미등록", `${without.length}팀`],
        ].map(([k, v]) => (
          <div key={k} className="bg-page px-4 py-3">
            <dt className="text-[11px] uppercase tracking-[0.15em] text-fg/50">{k}</dt>
            <dd className="mt-1 text-lg font-bold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby={`${id}-list`}>
        <Label id={`${id}-list`}>등록된 데모</Label>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-t border-fg/15 text-left text-sm">
            <thead className="text-xs text-fg/50">
              <tr className="border-b border-fg/15">
                <th className="py-2 pr-3 font-normal">팀</th>
                <th className="py-2 pr-3 font-normal">데모</th>
                <th className="py-2 pr-3 font-normal">상태</th>
                <th className="py-2 pr-3 font-normal">수정</th>
                <th className="py-2 font-normal">
                  <span className="sr-only">관리</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const t = teamOf(e.teamId);
                return (
                  <tr key={e.id} className={`border-b border-fg/10 align-middle ${e.hidden ? "bg-[var(--g-red)]/[0.06]" : ""}`}>
                    <td className="py-2.5 pr-3 text-fg/70">
                      <span className="tabular-nums">{t?.table}</span> · {t?.name}
                    </td>
                    <td className="py-2.5 pr-3 font-bold">{entryTitle(e, t)}</td>
                    <td className="py-2.5 pr-3">
                      <StatusChip entry={e} />
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-xs text-fg/50">{timeLabel(e.updatedAt)}</td>
                    <td className="py-2.5 text-right">
                      <button type="button" onClick={() => setOpen(e.id)} className={smallBtn}>
                        보기 · 관리
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {entries.length === 0 && <p className="py-6 text-sm text-fg/50">아직 등록된 데모가 없습니다.</p>}
        {without.length > 0 && (
          <p className="mt-3 text-xs text-fg/50">미등록: {without.map((t) => t.name).join(", ")}</p>
        )}
      </section>

      <section aria-labelledby={`${id}-preview`}>
        <Label id={`${id}-preview`}>참가자 화면 미리보기</Label>
        <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries
            .filter((e) => e.status === "published" && !e.hidden)
            .map((e) => (
              <MarketCard
                key={e.id}
                entry={e}
                team={teamOf(e.teamId)}
                members={membersOf(state, e.teamId)}
                mine={false}
                onOpen={() => setOpen(e.id)}
              />
            ))}
        </ul>
      </section>
    </div>
  );
}

function Moderate({ entry, onDeleted }: { entry: MarketEntry; onDeleted: () => void }) {
  const id = useId();
  const [reason, setReason] = useState(entry.hiddenReason ?? "");
  const [arm, setArm] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "실패했습니다.");
      else after?.();
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {entry.hidden ? (
        <button type="button" disabled={pending} onClick={() => run(() => setEntryHidden(entry.id, false, ""))} className={primaryBtn}>
          다시 보이기
        </button>
      ) : (
        <>
          <label htmlFor={`${id}-reason`} className="sr-only">
            숨김 사유
          </label>
          <input
            id={`${id}-reason`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="숨김 사유 (팀에게 표시)"
            className={`${fieldCls} mt-0 w-56 py-1.5`}
          />
          <button type="button" disabled={pending} onClick={() => run(() => setEntryHidden(entry.id, true, reason))} className={smallBtn}>
            숨기기
          </button>
        </>
      )}
      {arm ? (
        <span className="inline-flex gap-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => deleteEntry(entry.id), onDeleted)}
            className="border border-[var(--g-red)] px-2.5 py-1.5 text-sm font-bold text-[var(--g-red)]"
          >
            삭제 확인
          </button>
          <button type="button" onClick={() => setArm(false)} className={smallBtn}>
            취소
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setArm(true)} className={`${smallBtn} text-fg/60`}>
          삭제
        </button>
      )}
      {error && (
        <p role="alert" className="w-full text-sm text-[var(--g-red)]">
          {error}
        </p>
      )}
    </div>
  );
}
