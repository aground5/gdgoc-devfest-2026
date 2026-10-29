"use client";

// Participant screen (/onfestival). Shows only what an individual participant should see:
// their own team and attendance, the team list, their own investments, and the
// investment ticks staff have published (never live totals).

import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { checkIn, confirmInvestments, updateMyTeam } from "@/app/onfestival/actions";
import { budgetOf, membersOf, won } from "@/lib/festival/selectors";
import type { FestivalState, Participant, Team } from "@/lib/festival/types";
import {
  Label,
  MemberStripe,
  SchoolChip,
  ScreenFrame,
  Status,
  fieldCls,
  primaryBtn,
  school,
  schoolsOf,
  smallBtn,
  useHashTab,
} from "./festival-ui";
import { PublishedStatus } from "./investment-status";

const VIEWS = [
  { id: "team", label: "내 팀" },
  { id: "invest", label: "투자" },
  { id: "market", label: "데모 마켓" },
] as const;

// `market` is the Demo Market panel, rendered on the server side of the page.
export function LiveScreen({ state, meId, market }: { state: FestivalState; meId: string; market: ReactNode }) {
  const [view, setView] = useHashTab(VIEWS, "team");
  const me = state.participants.find((p) => p.id === meId);
  const myTeam = me?.teamId ? state.teams.find((t) => t.id === me.teamId) : undefined;

  return (
    <ScreenFrame tabs={VIEWS} active={view} onTab={setView} who={me?.name}>
      {!me ? (
        <p className="py-10 text-lg text-fg/60">참가자 정보를 찾을 수 없습니다. 운영진에게 문의해 주세요.</p>
      ) : view === "team" ? (
        <div className="grid gap-10 lg:grid-cols-[1fr_26rem]">
          <div className="grid content-start gap-6">
            {myTeam ? (
              <MyTeamCard state={state} team={myTeam} />
            ) : (
              <section className="border border-fg/15 p-5 sm:p-7">
                <Label>내 팀</Label>
                <p className="mt-3 text-lg font-bold">아직 팀이 배정되지 않았습니다.</p>
                <p className="mt-1 text-sm text-fg/60">운영진이 팀을 배정하면 여기에 표시됩니다.</p>
              </section>
            )}
            <AttendanceCard me={me} />
          </div>
          <TeamList state={state} myTeamId={myTeam?.id} />
        </div>
      ) : view === "invest" ? (
        <div className="grid gap-10">
          <InvestPanel state={state} me={me} />
          <PublishedStatus state={state} myTeamId={myTeam?.id} />
        </div>
      ) : (
        market
      )}
    </ScreenFrame>
  );
}

/* ---------- My team ---------- */

function MyTeamCard({ state, team }: { state: FestivalState; team: Team }) {
  const [editing, setEditing] = useState(false);
  const members = membersOf(state, team.id);
  const mix = schoolsOf(members);

  return (
    <section aria-labelledby="my-team" className="border border-fg/15 bg-fg/[0.04]">
      <MemberStripe people={members} />
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Label id="my-team">내 팀</Label>
            <p className="mt-2 break-words text-3xl font-bold tracking-tight sm:text-4xl">{team.name}</p>
            <p className="mt-1 text-sm text-fg/60">
              테이블 <span className="tabular-nums text-fg">{team.table}</span>
              {mix.length > 0 && " · "}
              {mix.length > 1 ? `${mix.length}개 학교 연합` : mix[0] && `GDG on Campus ${mix[0].word}`}
            </p>
          </div>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className={`shrink-0 ${smallBtn}`}>
              정보 수정
            </button>
          )}
        </div>

        {editing ? (
          <TeamForm team={team} members={members} onDone={() => setEditing(false)} />
        ) : (
          <dl className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-fg/50">프로젝트</dt>
              <dd className="mt-1 text-lg font-bold">{team.project || "—"}</dd>
              {team.desc && <dd className="mt-1 text-sm leading-relaxed text-fg/70">{team.desc}</dd>}
            </div>
            <div>
              <dt className="text-xs text-fg/50">팀원 {members.length}명</dt>
              <dd className="mt-2">
                <ul className="grid gap-1.5">
                  {members.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 text-sm">
                      <SchoolChip s={school(m.school)} className="h-3 w-3" />
                      <span className="font-normal">{m.name}</span>
                      <span className="text-fg/40">{school(m.school).word}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  );
}

// Members are assigned by staff, so only team details are editable.
function TeamForm({ team, members, onDone }: { team: Team; members: Participant[]; onDone: () => void }) {
  const id = useId();
  const [name, setName] = useState(team.name);
  const [project, setProject] = useState(team.project);
  const [desc, setDesc] = useState(team.desc);
  const [error, setError] = useState("");
  const [saving, startSaving] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("팀명을 입력해 주세요.");
    startSaving(async () => {
      const res = await updateMyTeam({ name, project, desc });
      if (res.ok) onDone();
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <label htmlFor={`${id}-name`} className="text-xs text-fg/60">
          팀명
          <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} />
        </label>
        <label htmlFor={`${id}-project`} className="text-xs text-fg/60">
          프로젝트명
          <input id={`${id}-project`} value={project} onChange={(e) => setProject(e.target.value)} className={fieldCls} />
        </label>
      </div>
      <label htmlFor={`${id}-desc`} className="text-xs text-fg/60">
        한 줄 소개
        <input id={`${id}-desc`} value={desc} onChange={(e) => setDesc(e.target.value)} className={fieldCls} />
      </label>

      <div>
        <p className="text-xs text-fg/60">팀원</p>
        <ul className="mt-1.5 flex flex-wrap gap-2">
          {members.map((m) => (
            <li key={m.id} className="inline-flex items-center gap-2 border border-fg/15 px-2.5 py-1 text-sm text-fg/70">
              <SchoolChip s={school(m.school)} className="h-3 w-3" />
              {m.name}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-fg/40">팀원은 운영진이 배정합니다. 변경이 필요하면 운영진에게 문의해 주세요.</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--g-red)]">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={primaryBtn}>
          {saving ? "저장 중…" : "저장"}
        </button>
        <button type="button" onClick={onDone} className={smallBtn}>
          취소
        </button>
      </div>
    </form>
  );
}

/* ---------- Attendance ---------- */

// The code is checked on the server; participants never receive it.
function AttendanceCard({ me }: { me: Participant }) {
  const id = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [checking, startChecking] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    startChecking(async () => {
      const res = await checkIn(code);
      if (!res.ok) return setError(res.error);
      if (!res.data) return setError("출석 코드가 올바르지 않습니다. 운영진에게 다시 확인해 주세요.");
      setError("");
      setCode("");
    });
  }

  return (
    <section aria-labelledby={`${id}-title`} className="border border-fg/15 p-5 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <Label id={`${id}-title`}>내 출석</Label>
        <Status on={me.checkedIn} />
      </div>

      {me.checkedIn ? (
        <p className="mt-4 text-lg font-bold">{me.name}님, 출석이 확인되었습니다.</p>
      ) : (
        <form onSubmit={submit} className="mt-4" noValidate>
          <label htmlFor={`${id}-code`} className="text-sm text-fg/70">
            현장에 표시된 출석 코드를 입력하세요
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id={`${id}-code`}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                setError("");
              }}
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              placeholder="0000"
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-err` : undefined}
              className="w-36 border border-fg/20 bg-fg/[0.04] px-3 py-2.5 text-center tabular-nums text-2xl tracking-[0.4em] text-fg outline-none transition placeholder:text-fg/20 focus:border-fg/60"
            />
            <button type="submit" disabled={code.length < 4 || checking} className={`${primaryBtn} px-5 text-base`}>
              {checking ? "확인 중…" : "출석하기"}
            </button>
          </div>
          {error && (
            <p id={`${id}-err`} role="alert" className="mt-2 text-sm text-[var(--g-red)]">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

/* ---------- All teams ---------- */

function TeamList({ state, myTeamId }: { state: FestivalState; myTeamId?: string }) {
  const id = useId();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const rows = state.teams
    .map((t) => ({ team: t, members: membersOf(state, t.id) }))
    .filter(
      ({ team: t, members }) =>
        !query || [t.name, t.project, t.table, ...members.map((m) => m.name)].some((v) => v.toLowerCase().includes(query)),
    );

  return (
    <section aria-labelledby={`${id}-title`}>
      <div className="flex items-baseline justify-between gap-4">
        <Label id={`${id}-title`}>참가 팀</Label>
        <span className="tabular-nums text-xs text-fg/50">{state.teams.length}팀</span>
      </div>
      <label htmlFor={`${id}-q`} className="sr-only">
        팀 검색
      </label>
      <input
        id={`${id}-q`}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="팀명, 프로젝트, 팀원, 테이블 검색"
        className={`${fieldCls} mt-3`}
      />
      <ul className="mt-3 border-t border-fg/10">
        {rows.map(({ team: t, members }) => {
          const mine = t.id === myTeamId;
          const mix = schoolsOf(members);
          return (
            <li
              key={t.id}
              aria-current={mine ? "true" : undefined}
              className={`flex items-center gap-3 border-b border-fg/10 px-2 py-3 ${mine ? "bg-fg/[0.08] outline outline-1 outline-fg/40" : ""}`}
            >
              <span className="w-10 shrink-0 tabular-nums text-xs text-fg/50">{t.table}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-bold">{t.name}</span>
                  {mine && <span className="shrink-0 bg-fg px-1.5 py-0.5 text-[10px] font-bold text-page">MY</span>}
                </span>
                <span className="mt-1 flex items-center gap-2 text-xs text-fg/50">
                  <span className="flex gap-0.5" aria-label={mix.map((s) => s.word).join(", ")}>
                    {mix.map((s) => (
                      <SchoolChip key={s.key} s={s} className="h-2.5 w-2.5" />
                    ))}
                  </span>
                  <span className="truncate">
                    {t.project} · {members.length}명
                  </span>
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && <p className="py-6 text-sm text-fg/50">검색 결과가 없습니다.</p>}
    </section>
  );
}

/* ---------- Investment ---------- */

function InvestPanel({ state, me }: { state: FestivalState; me: Participant }) {
  // Confirmed amounts live in the shared store; edits stay in a local draft until confirmed.
  const saved = state.investments[me.id] ?? null;
  const [draft, setDraft] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState("");
  const [confirming, startConfirming] = useTransition();
  const amounts = draft ?? saved ?? {};
  const step = state.investStep;

  // Total budget is set per person by staff
  const budget = budgetOf(state, me.id);
  const targets = state.teams.filter((t) => t.id !== me.teamId);
  const used = targets.reduce((sum, t) => sum + (amounts[t.id] ?? 0), 0);
  const left = budget - used;
  const over = left < 0;
  const scale = Math.max(budget, used, 1);
  const invested = targets.filter((t) => (amounts[t.id] ?? 0) > 0);
  const dirty = saved === null || targets.some((t) => (amounts[t.id] ?? 0) !== (saved[t.id] ?? 0));
  const upToDate = saved !== null && !dirty;

  function change(teamId: string, v: number) {
    setDraft({ ...amounts, [teamId]: v });
    setError("");
  }

  function confirm() {
    const clean = Object.fromEntries(
      targets.map((t) => [t.id, amounts[t.id] ?? 0] as const).filter(([, v]) => v > 0),
    );
    startConfirming(async () => {
      const res = await confirmInvestments(clean);
      if (res.ok) setDraft(null);
      else setError(res.error);
    });
  }

  return (
    <div className="grid gap-8">
      <section aria-labelledby="invest-summary" className="border border-fg/15 bg-fg/[0.04] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Label id="invest-summary">내 투자금</Label>
            <p
              className={`mt-2  text-4xl font-bold tracking-tight tabular-nums sm:text-5xl ${over ? "text-[var(--g-red)]" : ""}`}
            >
              {over ? `−${won(-left)}` : won(left)}
            </p>
            <p className="mt-1 text-sm text-fg/60">
              남은 금액 · 총 {won(budget)} 중 {won(used)} 투자
            </p>
          </div>
          {upToDate ? (
            <span className="inline-flex items-center gap-2 border border-[var(--g-green)] px-4 py-2 text-sm font-bold text-[var(--g-green)]">
              <span className="h-1.5 w-1.5 bg-[var(--g-green)]" />
              확정됨
            </span>
          ) : (
            <button
              type="button"
              onClick={confirm}
              disabled={over || confirming || (saved === null && used === 0)}
              className={`${primaryBtn} px-5 py-2.5 text-base`}
            >
              {confirming ? "확정 중…" : saved === null ? "투자 확정하기" : "변경사항 확정하기"}
            </button>
          )}
        </div>

        <div
          className="mt-6 flex h-3 gap-px bg-fg/10"
          role="meter"
          aria-label="투자금 사용률"
          aria-valuemin={0}
          aria-valuemax={budget}
          aria-valuenow={used}
        >
          {invested.map((t, i) => (
            <span
              key={t.id}
              className="h-full bg-fg"
              title={`${t.project} ${won(amounts[t.id])}`}
              style={{ width: `${(amounts[t.id] / scale) * 100}%`, opacity: i % 2 ? 0.55 : 0.9 }}
            />
          ))}
        </div>
        {error ? (
          <p role="alert" className="mt-3 flex items-center gap-2 text-xs font-bold text-fg">
            <span className="h-2 w-2 shrink-0 bg-[var(--g-red)]" aria-hidden="true" />
            {error}
          </p>
        ) : over ? (
          <p role="alert" className="mt-3 flex items-center gap-2 text-xs font-bold text-fg">
            <span className="h-2 w-2 shrink-0 bg-[var(--g-red)]" aria-hidden="true" />
            운영진이 전체 투자금을 {won(budget)}으로 조정했습니다. {won(-left)}을 줄여야 확정할 수 있습니다.
          </p>
        ) : saved !== null && dirty ? (
          <p role="status" className="mt-3 flex items-center gap-2 text-xs font-bold text-fg">
            <span className="h-2 w-2 shrink-0 bg-[var(--g-yellow)]" aria-hidden="true" />
            확정 후 바뀐 내용이 있습니다. 다시 확정해야 반영됩니다.
          </p>
        ) : (
          <p role="status" className="mt-3 text-xs text-fg/40">
            {upToDate
              ? "확정된 투자입니다. 언제든 다시 바꾸고 확정할 수 있습니다."
              : `${won(step)} 단위로 투자할 수 있습니다. 내 팀 프로젝트에는 투자할 수 없습니다.`}
          </p>
        )}
      </section>

      <section aria-labelledby="invest-projects">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <Label id="invest-projects">프로젝트</Label>
          <span className="tabular-nums text-xs text-fg/50">
            {targets.length}개 · 투자 {invested.length}
          </span>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {targets.map((t) => (
            <InvestCard
              key={t.id}
              team={t}
              members={membersOf(state, t.id)}
              amount={amounts[t.id] ?? 0}
              max={(amounts[t.id] ?? 0) + Math.max(0, left)}
              budget={budget}
              step={step}
              savedAmount={saved ? (saved[t.id] ?? 0) : undefined}
              onChange={(v) => change(t.id, v)}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function InvestCard({
  team,
  members,
  amount,
  max,
  savedAmount,
  budget,
  step,
  onChange,
}: {
  team: Team;
  members: Participant[];
  amount: number;
  max: number;
  savedAmount?: number;
  budget: number;
  step: number;
  onChange: (amount: number) => void;
}) {
  const id = useId();
  const set = (v: number) => onChange(Math.max(0, Math.min(max, v)));
  const changed = savedAmount !== undefined && savedAmount !== amount;
  const stepBtn =
    "grid h-11 w-11 shrink-0 place-items-center border border-fg/20 text-lg transition hover:bg-fg/10 disabled:opacity-25 disabled:hover:bg-transparent";

  return (
    <li className={`flex flex-col border ${amount > 0 ? "border-fg/50 bg-fg/[0.06]" : "border-fg/15"}`}>
      <MemberStripe people={members} className="h-1.5" />
      <div className="flex flex-1 flex-col p-5">
        <p className="tabular-nums text-xs text-fg/50">
          {team.table} · {team.name}
        </p>
        <h3 className="mt-2 text-xl font-bold leading-snug">{team.project}</h3>
        {team.desc && <p className="mt-1 text-sm leading-relaxed text-fg/60">{team.desc}</p>}

        <div className="mt-auto pt-5">
          <label htmlFor={`${id}-amt`} className="text-xs text-fg/50">
            투자 금액
          </label>
          <div className="mt-1.5 flex gap-1.5">
            <button
              type="button"
              aria-label={`${team.project} 투자금 ${won(step)} 줄이기`}
              disabled={amount === 0}
              onClick={() => set(amount - step)}
              className={stepBtn}
            >
              −
            </button>
            <input
              id={`${id}-amt`}
              inputMode="numeric"
              autoComplete="off"
              value={amount ? amount.toLocaleString("ko-KR") : ""}
              placeholder="0"
              onChange={(e) => set(Number(e.target.value.replace(/\D/g, "")) || 0)}
              onBlur={() => set(Math.round(amount / step) * step)}
              className="h-11 min-w-0 flex-1 border border-fg/20 bg-fg/[0.04] px-3 text-right text-lg tabular-nums text-fg outline-none transition placeholder:text-fg/25 focus:border-fg/60"
            />
            <button
              type="button"
              aria-label={`${team.project} 투자금 ${won(step)} 늘리기`}
              disabled={amount >= max}
              onClick={() => set(amount + step)}
              className={stepBtn}
            >
              +
            </button>
          </div>
          <p className="mt-2 flex justify-between gap-2 tabular-nums text-xs text-fg/40">
            <span className={`flex items-center gap-1.5 ${changed ? "text-fg/70" : ""}`}>
              {changed ? (
                <>
                  <span className="h-1.5 w-1.5 bg-[var(--g-yellow)]" aria-hidden="true" />
                  확정 {won(savedAmount)}
                </>
              ) : (
                " "
              )}
            </span>
            <span>{amount > 0 ? `내 투자금의 ${Math.round((amount / Math.max(1, budget)) * 100)}%` : ""}</span>
          </p>
        </div>
      </div>
    </li>
  );
}
