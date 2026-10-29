"use client";

// Admin screen (/organize): participants, teams, attendance, live investment status,
// and publishing investment ticks (snapshots) that participants see.

import { createContext, useContext, useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { schools } from "./brand";
import * as act from "@/app/organize/actions";
import type { ActionResult } from "@/lib/festival/result";
import { budgetOf, investedBy, latestTick, liveTotals, membersOf, timeLabel, won } from "@/lib/festival/selectors";
import type { FestivalState, Participant, SchoolKey, StaffExtras, Team } from "@/lib/festival/types";
import {
  Label,
  MemberStripe,
  RankBar,
  SchoolChip,
  ScreenFrame,
  Status,
  fieldCls,
  primaryBtn,
  school,
  selectCls,
  smallBtn,
  useHashTab,
} from "./festival-ui";
import { PublishedStatus } from "./investment-status";

const VIEWS = [
  { id: "people", label: "참가자" },
  { id: "teams", label: "팀" },
  { id: "attendance", label: "출석" },
  { id: "budget", label: "투자금" },
  { id: "invest", label: "투자 현황" },
  { id: "market", label: "데모 마켓" },
] as const;

/* ---------- Running staff actions ---------- */

// Failed writes are reported in one banner at the top of the screen.
const ReportContext = createContext<(message: string) => void>(() => {});

function useRun() {
  const report = useContext(ReportContext);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult<unknown>>, onOk?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) onOk?.();
      else report(res.error);
    });
  return [run, pending] as const;
}

/* ---------- Screen ---------- */

// `market` is the Demo Market moderation panel, rendered by the page.
export function AdminScreen({
  state,
  extras,
  who,
  market,
}: {
  state: FestivalState;
  extras: StaffExtras;
  who?: string;
  market: ReactNode;
}) {
  const [view, setView] = useHashTab(VIEWS, "people");
  const [problem, setProblem] = useState("");

  const present = state.participants.filter((p) => p.checkedIn).length;
  const investors = state.participants.filter((p) => Object.values(state.investments[p.id] ?? {}).some((v) => v > 0)).length;

  return (
    <ReportContext.Provider value={setProblem}>
    <ScreenFrame badge="운영진" who={who} tabs={VIEWS} active={view} onTab={setView}>
      {problem && (
        <p role="alert" className="mb-6 flex items-center justify-between gap-3 border border-[var(--g-red)] px-4 py-3 text-sm font-bold">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 bg-[var(--g-red)]" aria-hidden="true" />
            {problem}
          </span>
          <button type="button" onClick={() => setProblem("")} className={smallBtn}>
            닫기
          </button>
        </p>
      )}
      <dl className="mb-8 grid grid-cols-2 gap-px border border-fg/10 bg-fg/10 sm:grid-cols-4">
        {[
          ["참가자", `${state.participants.length}명`],
          ["팀", `${state.teams.length}팀`],
          ["출석", `${present} / ${state.participants.length}`],
          ["투자 확정", `${investors}명`],
        ].map(([k, v]) => (
          <div key={k} className="bg-page px-4 py-3">
            <dt className="tabular-nums text-[11px] uppercase tracking-[0.15em] text-fg/50">{k}</dt>
            <dd className="mt-1 text-lg font-bold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      {view === "people" && <PeoplePanel state={state} logins={extras.logins} />}
      {view === "teams" && <TeamsPanel state={state} />}
      {view === "attendance" && <AttendancePanel state={state} code={extras.attendanceCode} />}
      {view === "budget" && <BudgetPanel state={state} />}
      {view === "invest" && <InvestStatusPanel state={state} />}
      {view === "market" && market}
    </ScreenFrame>
    </ReportContext.Provider>
  );
}

// Two-step delete so a stray click doesn't remove anything
function DeleteButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [arm, setArm] = useState(false);
  return arm ? (
    <span className="inline-flex gap-1">
      <button type="button" onClick={onConfirm} className="border border-[var(--g-red)] px-2.5 py-1.5 text-sm font-bold text-[var(--g-red)]">
        삭제 확인
      </button>
      <button type="button" onClick={() => setArm(false)} className={smallBtn}>
        취소
      </button>
    </span>
  ) : (
    <button type="button" onClick={() => setArm(true)} aria-label={label} className={`${smallBtn} text-fg/60`}>
      삭제
    </button>
  );
}

function SchoolSelect({ value, onChange, label }: { value: SchoolKey; onChange: (v: SchoolKey) => void; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as SchoolKey)} className={selectCls}>
      {schools.map((s) => (
        <option key={s.key} value={s.key}>
          {s.word}
        </option>
      ))}
    </select>
  );
}

function TeamSelect({
  teams,
  value,
  onChange,
  label,
}: {
  teams: Team[];
  value: string | null;
  onChange: (v: string | null) => void;
  label: string;
}) {
  return (
    <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={`${selectCls} max-w-[12rem]`}>
      <option value="">미배정</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.table} · {t.name}
        </option>
      ))}
    </select>
  );
}

/* ---------- 참가자 관리 ---------- */

type Logins = StaffExtras["logins"];
type Issued = { participantId: string; code: string }[];

function PeoplePanel({ state, logins }: { state: FestivalState; logins: Logins }) {
  const id = useId();
  const report = useContext(ReportContext);
  const [issued, setIssued] = useState<Issued>([]);
  const [issuing, startIssuing] = useTransition();
  const issue = (ids: string[]) =>
    startIssuing(async () => {
      const res = await act.issueCodes(ids);
      if (!res.ok) return report(res.error);
      setIssued((prev) => [...res.data, ...prev.filter((x) => !res.data.some((y) => y.participantId === x.participantId))]);
    });
  const [q, setQ] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const query = q.trim().toLowerCase();
  const teamName = (tid: string | null) => state.teams.find((t) => t.id === tid)?.name ?? "";

  const rows = state.participants.filter(
    (p) =>
      (teamFilter === "all" || (teamFilter === "none" ? !p.teamId : p.teamId === teamFilter)) &&
      (!query ||
        p.name.toLowerCase().includes(query) ||
        teamName(p.teamId).toLowerCase().includes(query) ||
        (logins[p.id]?.loginId ?? "").toLowerCase().includes(query)),
  );
  const unassigned = state.participants.filter((p) => !p.teamId).length;
  const noCode = state.participants.filter((p) => !logins[p.id]?.issued);

  return (
    <div className="grid gap-8">
      <AddParticipant teams={state.teams} />

      <section aria-labelledby={`${id}-codes`} className="border border-fg/15 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Label id={`${id}-codes`}>로그인 코드</Label>
          <button
            type="button"
            disabled={issuing || noCode.length === 0}
            onClick={() => issue(noCode.map((p) => p.id))}
            className={primaryBtn}
          >
            {issuing ? "발급 중…" : `미발급 ${noCode.length}명에게 발급`}
          </button>
        </div>
        <p className="mt-2 text-sm text-fg/60">
          참가자는 운영진이 발급한 코드로 로그인합니다. 코드는 발급할 때 한 번만 보이니 바로 인쇄하거나 전달해 주세요. 재발급하면
          이전 코드와 로그인된 기기가 모두 무효가 됩니다.
        </p>
        {issued.length > 0 && <IssuedCodes issued={issued} state={state} onClose={() => setIssued([])} />}
      </section>

      <section aria-labelledby={`${id}-title`}>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <Label id={`${id}-title`}>참가자 목록</Label>
          <span className="tabular-nums text-xs text-fg/50">
            {rows.length}명 표시{unassigned > 0 && ` · 미배정 ${unassigned}명`}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <label htmlFor={`${id}-q`} className="sr-only">
            참가자 검색
          </label>
          <input
            id={`${id}-q`}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름, 팀명, 로그인 ID 검색"
            className={`${fieldCls} mt-0 min-w-0 flex-1`}
          />
          <select aria-label="팀 필터" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className={selectCls}>
            <option value="all">전체 팀</option>
            <option value="none">미배정</option>
            {state.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.table} · {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[48rem] border-t border-fg/15 text-left text-sm">
            <thead className="text-xs text-fg/50">
              <tr className="border-b border-fg/15">
                <th className="py-2 pr-3 font-normal">이름</th>
                <th className="py-2 pr-3 font-normal">학교</th>
                <th className="py-2 pr-3 font-normal">로그인</th>
                <th className="py-2 pr-3 font-normal">팀</th>
                <th className="py-2 pr-3 font-normal">출석</th>
                <th className="py-2 font-normal">
                  <span className="sr-only">관리</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <PersonRow
                  key={p.id}
                  p={p}
                  login={logins[p.id]}
                  teams={state.teams}
                  issuing={issuing}
                  onIssue={() => issue([p.id])}
                />
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="py-6 text-sm text-fg/50">조건에 맞는 참가자가 없습니다.</p>}
      </section>
    </div>
  );
}

function PersonRow({
  p,
  login,
  teams,
  issuing,
  onIssue,
}: {
  p: Participant;
  login?: Logins[string];
  teams: Team[];
  issuing: boolean;
  onIssue: () => void;
}) {
  const [run, pending] = useRun();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [sch, setSch] = useState(p.school);

  function save() {
    if (!name.trim()) return;
    run(() => act.updateParticipant(p.id, { name, school: sch }), () => setEditing(false));
  }

  return (
    <tr className={`border-b border-fg/10 align-middle ${!p.teamId ? "bg-[var(--g-yellow)]/[0.08]" : ""}`}>
      <td className="py-2.5 pr-3">
        {editing ? (
          <input
            aria-label="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className={`${fieldCls} mt-0 py-1.5`}
          />
        ) : (
          <span className="font-bold">{p.name}</span>
        )}
      </td>
      <td className="py-2.5 pr-3">
        {editing ? (
          <SchoolSelect label="학교" value={sch} onChange={setSch} />
        ) : (
          <span className="inline-flex items-center gap-2">
            <SchoolChip s={school(p.school)} className="h-3 w-3" />
            {school(p.school).word}
          </span>
        )}
      </td>
      <td className="py-2.5 pr-3">
        <span className="inline-flex items-center gap-2">
          <span className="tabular-nums text-xs text-fg/60">{login?.loginId}</span>
          {login?.issued ? (
            <span className="text-xs font-bold text-[var(--g-green)]">발급됨</span>
          ) : (
            <span className="text-xs text-fg/40">미발급</span>
          )}
          <button type="button" disabled={issuing} onClick={onIssue} className={`${smallBtn} px-2 py-1 text-xs`}>
            {login?.issued ? "재발급" : "발급"}
          </button>
        </span>
      </td>
      <td className="py-2.5 pr-3">
        <TeamSelect label={`${p.name} 팀 배정`} teams={teams} value={p.teamId} onChange={(v) => run(() => act.assignTeam(p.id, v))} />
      </td>
      <td className="py-2.5 pr-3">
        <Status on={p.checkedIn} />
      </td>
      <td className="py-2.5 text-right">
        <span className="inline-flex gap-1">
          {editing ? (
            <>
              <button type="button" onClick={save} disabled={pending} className={primaryBtn}>
                저장
              </button>
              <button
                type="button"
                onClick={() => {
                  setName(p.name);
                  setSch(p.school);
                  setEditing(false);
                }}
                className={smallBtn}
              >
                취소
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setEditing(true)} className={smallBtn}>
                수정
              </button>
              <DeleteButton label={`${p.name} 삭제`} onConfirm={() => run(() => act.removeParticipant(p.id))} />
            </>
          )}
        </span>
      </td>
    </tr>
  );
}

const short = (n: number) => `${(n / 10_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만`;

function BudgetCell({
  id,
  name,
  budget,
  step,
  isDefault,
}: {
  id: string;
  name: string;
  budget: number;
  step: number;
  isDefault: boolean;
}) {
  const [run] = useRun();
  const [draft, setDraft] = useState<string | null>(null);
  const setBudget = (amount: number) => run(() => act.setBudgets([id], amount));
  const commit = () => {
    if (draft !== null) setBudget(Number(draft.replace(/\D/g, "")) || 0);
    setDraft(null);
  };
  const stepBtn = "grid h-8 w-7 shrink-0 place-items-center border border-fg/20 text-sm transition hover:bg-fg/10 disabled:opacity-25";

  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        <button
          type="button"
          aria-label={`${name} 투자금 ${won(step)} 줄이기`}
          disabled={budget <= 0}
          onClick={() => setBudget(budget - step)}
          className={stepBtn}
        >
          −
        </button>
        <input
          aria-label={`${name} 전체 투자금`}
          inputMode="numeric"
          autoComplete="off"
          value={draft ?? budget.toLocaleString("ko-KR")}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setDraft(null);
          }}
          className={`h-8 w-24 border-y border-fg/20 bg-fg/[0.04] px-2 text-right  text-xs tabular-nums text-fg outline-none focus:border-fg/60 ${isDefault ? "" : "font-bold"}`}
        />
        <button
          type="button"
          aria-label={`${name} 투자금 ${won(step)} 늘리기`}
          onClick={() => setBudget(budget + step)}
          className={stepBtn}
        >
          +
        </button>
      </div>
    </div>
  );
}

function BulkBudget({
  ids,
  filtered,
  defaultBudget,
  step,
}: {
  ids: string[];
  filtered: boolean;
  defaultBudget: number;
  step: number;
}) {
  const fid = useId();
  const [run, pending] = useRun();
  const [value, setValue] = useState("");
  const amount = Number(value) || 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value) run(() => act.setBudgets(ids, amount), () => setValue(""));
      }}
      className="mt-3 flex flex-wrap items-center gap-2 border border-fg/10 bg-fg/[0.03] px-3 py-2.5"
    >
      <label htmlFor={`${fid}-amt`} className="text-sm font-bold">
        투자금 일괄 설정
      </label>
      <input
        id={`${fid}-amt`}
        inputMode="numeric"
        autoComplete="off"
        value={value ? Number(value).toLocaleString("ko-KR") : ""}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        placeholder={defaultBudget.toLocaleString("ko-KR")}
        className="h-9 w-32 border border-fg/20 bg-fg/[0.04] px-2 text-right text-sm tabular-nums text-fg outline-none placeholder:text-fg/30 focus:border-fg/60"
      />
      <span className="text-sm text-fg/50">원</span>
      <button type="submit" disabled={!value || ids.length === 0 || pending} className={primaryBtn}>
        {filtered ? `표시된 ${ids.length}명에게 적용` : `전체 ${ids.length}명에게 적용`}
      </button>
      <button
        type="button"
        onClick={() => run(() => act.setBudgets(ids, defaultBudget))}
        disabled={ids.length === 0 || pending}
        className={smallBtn}
      >
        기본값({short(defaultBudget)}원)으로
      </button>
      <span className="text-xs text-fg/40">{won(step)} 단위로 맞춰집니다.</span>
    </form>
  );
}

/* ---------- 투자금 관리 ---------- */

function BudgetPanel({ state }: { state: FestivalState }) {
  const id = useId();
  const [q, setQ] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [onlyOver, setOnlyOver] = useState(false);
  const query = q.trim().toLowerCase();
  const teamOf = (tid: string | null) => state.teams.find((t) => t.id === tid);

  const all = state.participants.map((p) => {
    const budget = budgetOf(state, p.id);
    const used = investedBy(state, p.id);
    return { p, budget, used, left: budget - used };
  });
  const rows = all.filter(
    ({ p, left }) =>
      (teamFilter === "all" || (teamFilter === "none" ? !p.teamId : p.teamId === teamFilter)) &&
      (!query || p.name.toLowerCase().includes(query) || (teamOf(p.teamId)?.name ?? "").toLowerCase().includes(query)) &&
      (!onlyOver || left < 0),
  );

  const pool = all.reduce((sum, r) => sum + r.budget, 0);
  const spent = all.reduce((sum, r) => sum + r.used, 0);
  const overCount = all.filter((r) => r.left < 0).length;
  const custom = all.filter((r) => state.budgets[r.p.id] !== undefined).length;

  return (
    <div className="grid gap-8">
      <dl className="grid grid-cols-2 gap-px border border-fg/10 bg-fg/10 sm:grid-cols-4">
        {[
          ["전체 투자금", won(pool)],
          ["확정된 투자", `${won(spent)} · ${pool ? Math.round((spent / pool) * 100) : 0}%`],
          ["기본값과 다른 인원", `${custom}명`],
          ["투자금 초과", `${overCount}명`],
        ].map(([k, v]) => (
          <div key={k} className="bg-page px-4 py-3">
            <dt className="tabular-nums text-[11px] uppercase tracking-[0.15em] text-fg/50">{k}</dt>
            <dd className={`mt-1 font-bold tabular-nums ${k === "투자금 초과" && overCount > 0 ? "text-[var(--g-red)]" : ""}`}>{v}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby={`${id}-title`}>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <Label id={`${id}-title`}>개인별 투자금</Label>
          <span className="tabular-nums text-xs text-fg/50">
            {rows.length}명 표시 · 기본 {won(state.defaultBudget)}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <label htmlFor={`${id}-q`} className="sr-only">
            참가자 검색
          </label>
          <input
            id={`${id}-q`}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름, 팀명 검색"
            className={`${fieldCls} mt-0 min-w-0 flex-1`}
          />
          <select aria-label="팀 필터" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className={selectCls}>
            <option value="all">전체 팀</option>
            <option value="none">미배정</option>
            {state.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.table} · {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-pressed={onlyOver}
            onClick={() => setOnlyOver((v) => !v)}
            className={`border px-3 text-sm transition ${onlyOver ? "border-fg bg-fg text-page" : "border-fg/20 text-fg/70 hover:border-fg/50"}`}
          >
            초과만
          </button>
        </div>

        <BulkBudget
          ids={rows.map((r) => r.p.id)}
          filtered={rows.length !== all.length}
          defaultBudget={state.defaultBudget}
          step={state.investStep}
        />

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-t border-fg/15 text-left text-sm">
            <thead className="text-xs text-fg/50">
              <tr className="border-b border-fg/15">
                <th className="py-2 pr-3 font-normal">이름</th>
                <th className="py-2 pr-3 font-normal">팀</th>
                <th className="py-2 pr-3 font-normal">전체 투자금</th>
                <th className="py-2 pr-3 text-right font-normal">확정 투자</th>
                <th className="py-2 text-right font-normal">남은 금액</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, budget, used, left }) => (
                <tr key={p.id} className={`border-b border-fg/10 align-middle ${left < 0 ? "bg-[var(--g-red)]/[0.06]" : ""}`}>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-2">
                      <SchoolChip s={school(p.school)} className="h-3 w-3" />
                      <span className="font-bold">{p.name}</span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-fg/60">{teamOf(p.teamId)?.name ?? "미배정"}</td>
                  <td className="py-2.5 pr-3">
                    <BudgetCell
                      id={p.id}
                      name={p.name}
                      budget={budget}
                      step={state.investStep}
                      isDefault={state.budgets[p.id] === undefined}
                    />
                  </td>
                  <td className="py-2.5 pr-3 text-right text-xs tabular-nums text-fg/70">{won(used)}</td>
                  <td className="py-2.5 text-right text-xs tabular-nums">
                    {left < 0 ? (
                      <span className="inline-flex items-center gap-1.5 font-bold text-[var(--g-red)]">
                        <span aria-hidden="true">▲</span>
                        {won(-left)} 초과
                      </span>
                    ) : (
                      <span className="text-fg/70">{won(left)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="py-6 text-sm text-fg/50">조건에 맞는 참가자가 없습니다.</p>}
        <p className="mt-3 text-xs text-fg/40">
          이미 확정한 금액보다 낮추면 해당 참가자는 금액을 줄이기 전까지 다시 확정할 수 없습니다.
        </p>
      </section>
    </div>
  );
}

function AddParticipant({ teams }: { teams: Team[] }) {
  const id = useId();
  const [name, setName] = useState("");
  const [sch, setSch] = useState<SchoolKey>("ku");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [adding, startAdding] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("이름을 입력해 주세요.");
    startAdding(async () => {
      const res = await act.addParticipant({ name, school: sch, teamId });
      if (!res.ok) return setError(res.error);
      setName("");
      setError("");
    });
  }

  return (
    <form onSubmit={submit} noValidate className="border border-fg/15 p-5">
      <Label>참가자 추가</Label>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label htmlFor={`${id}-name`} className="min-w-[10rem] flex-1 text-xs text-fg/60">
          이름
          <input
            id={`${id}-name`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            className={`${fieldCls} py-2`}
          />
        </label>
        <SchoolSelect label="학교" value={sch} onChange={setSch} />
        <TeamSelect label="팀" teams={teams} value={teamId} onChange={setTeamId} />
        <button type="submit" disabled={adding} className={`${primaryBtn} h-[2.4rem]`}>
          추가
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--g-red)]">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-fg/40">추가한 뒤 아래에서 로그인 코드를 발급해 주세요.</p>
    </form>
  );
}

// Codes from this issuing session. Shown once; printable as slips to hand out.
function IssuedCodes({ issued, state, onClose }: { issued: Issued; state: FestivalState; onClose: () => void }) {
  const person = (pid: string) => state.participants.find((p) => p.id === pid);
  const teamOf = (tid: string | null) => state.teams.find((t) => t.id === tid);
  return (
    <div className="mt-4 border border-fg/30 bg-fg/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p role="status" className="text-sm font-bold">
          {issued.length}명에게 새 코드를 발급했습니다. 이 화면을 닫으면 다시 볼 수 없습니다.
        </p>
        <span className="flex gap-1">
          <button type="button" onClick={() => window.print()} className={smallBtn}>
            인쇄
          </button>
          <button type="button" onClick={onClose} className={smallBtn}>
            닫기
          </button>
        </span>
      </div>
      <ul id="issued-codes" className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {issued.map(({ participantId, code }) => {
          const p = person(participantId);
          return (
            <li key={participantId} className="break-inside-avoid border border-dashed border-fg/40 px-4 py-3">
              <p className="text-xs text-fg/60">
                GDG DevFest 2026 · {teamOf(p?.teamId ?? null)?.name ?? "팀 미배정"}
              </p>
              <p className="mt-1 font-bold">{p?.name}</p>
              <p className="mt-1 select-all text-xl font-bold tracking-[0.15em] tabular-nums">{code}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- 팀 관리 ---------- */

function TeamsPanel({ state }: { state: FestivalState }) {
  const [run] = useRun();
  const unassigned = state.participants.filter((p) => !p.teamId);

  return (
    <div className="grid gap-8">
      <AddTeam />

      {unassigned.length > 0 && (
        <section aria-labelledby="unassigned" className="border border-fg/15 bg-[var(--g-yellow)]/[0.08] p-5">
          <Label id="unassigned">미배정 참가자 {unassigned.length}명</Label>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {unassigned.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm">
                  <SchoolChip s={school(p.school)} className="h-3 w-3" />
                  <span className="font-bold">{p.name}</span>
                </span>
                <TeamSelect label={`${p.name} 팀 배정`} teams={state.teams} value={null} onChange={(v) => run(() => act.assignTeam(p.id, v))} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="grid gap-4 md:grid-cols-2">
        {state.teams.map((t) => (
          <TeamCard key={t.id} team={t} members={membersOf(state, t.id)} />
        ))}
      </ul>
      {state.teams.length === 0 && <p className="text-fg/60">등록된 팀이 없습니다.</p>}
    </div>
  );
}

function TeamCard({ team, members }: { team: Team; members: Participant[] }) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(team);
  const [run, pending] = useRun();

  function save(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    run(() => act.updateTeam(team.id, form), () => setEditing(false));
  }

  const field = (key: keyof Omit<Team, "id">, label: string) => (
    <label htmlFor={`${id}-${key}`} className="text-xs text-fg/60">
      {label}
      <input
        id={`${id}-${key}`}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className={`${fieldCls} py-2`}
      />
    </label>
  );

  return (
    <li className="flex flex-col border border-fg/15">
      <MemberStripe people={members} className="h-1.5" />
      <div className="flex flex-1 flex-col p-5">
        {editing ? (
          <form onSubmit={save} noValidate className="grid gap-3">
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              {field("name", "팀명")}
              {field("table", "테이블")}
            </div>
            {field("project", "프로젝트명")}
            {field("desc", "한 줄 소개")}
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className={primaryBtn}>
                저장
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm(team);
                  setEditing(false);
                }}
                className={smallBtn}
              >
                취소
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="tabular-nums text-xs text-fg/50">{team.table || "테이블 미정"}</p>
                <h3 className="mt-1 truncate text-xl font-bold">{team.name}</h3>
                <p className="mt-0.5 text-sm text-fg/60">
                  {team.project || "프로젝트 미정"}
                  {team.desc && ` · ${team.desc}`}
                </p>
              </div>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setForm(team);
                    setEditing(true);
                  }}
                  className={smallBtn}
                >
                  수정
                </button>
                <DeleteButton label={`${team.name} 삭제`} onConfirm={() => run(() => act.removeTeam(team.id))} />
              </span>
            </div>
            <div className="mt-4">
              <p className="text-xs text-fg/50">팀원 {members.length}명</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {members.map((m) => (
                  <li key={m.id} className="inline-flex items-center gap-1.5 border border-fg/15 py-1 pl-2 pr-1 text-sm">
                    <SchoolChip s={school(m.school)} className="h-3 w-3" />
                    {m.name}
                    <button
                      type="button"
                      onClick={() => run(() => act.assignTeam(m.id, null))}
                      aria-label={`${m.name} 팀에서 빼기`}
                      title="팀에서 빼기"
                      className="grid h-5 w-5 place-items-center text-xs text-fg/40 transition hover:bg-fg/10 hover:text-fg"
                    >
                      ✕
                    </button>
                  </li>
                ))}
                {members.length === 0 && <li className="text-sm text-fg/40">배정된 팀원이 없습니다.</li>}
              </ul>
            </div>
          </>
        )}
      </div>
    </li>
  );
}

function AddTeam() {
  const id = useId();
  const [name, setName] = useState("");
  const [table, setTable] = useState("");
  const [project, setProject] = useState("");
  const [error, setError] = useState("");
  const [adding, startAdding] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("팀명을 입력해 주세요.");
    startAdding(async () => {
      const res = await act.addTeam({ name, table, project });
      if (!res.ok) return setError(res.error);
      setName("");
      setTable("");
      setProject("");
      setError("");
    });
  }

  return (
    <form onSubmit={submit} noValidate className="border border-fg/15 p-5">
      <Label>팀 추가</Label>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label htmlFor={`${id}-name`} className="min-w-[10rem] flex-1 text-xs text-fg/60">
          팀명
          <input
            id={`${id}-name`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            className={`${fieldCls} py-2`}
          />
        </label>
        <label htmlFor={`${id}-table`} className="w-24 text-xs text-fg/60">
          테이블
          <input id={`${id}-table`} value={table} onChange={(e) => setTable(e.target.value)} placeholder="D-01" className={`${fieldCls} py-2`} />
        </label>
        <label htmlFor={`${id}-project`} className="min-w-[10rem] flex-1 text-xs text-fg/60">
          프로젝트명
          <input id={`${id}-project`} value={project} onChange={(e) => setProject(e.target.value)} className={`${fieldCls} py-2`} />
        </label>
        <button type="submit" disabled={adding} className={`${primaryBtn} h-[2.4rem]`}>
          추가
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--g-red)]">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-fg/40">팀원 배정은 참가자 탭이나 아래 미배정 목록에서 할 수 있습니다.</p>
    </form>
  );
}

/* ---------- 출석 관리 ---------- */

function AttendancePanel({ state, code }: { state: FestivalState; code: string }) {
  const [run] = useRun();
  const [filter, setFilter] = useState<"all" | "absent" | "present">("all");
  const total = state.participants.length;
  const present = state.participants.filter((p) => p.checkedIn).length;

  const groups = [
    ...state.teams.map((t) => ({ key: t.id, title: `${t.table} · ${t.name}`, people: membersOf(state, t.id) })),
    { key: "none", title: "미배정", people: state.participants.filter((p) => !p.teamId) },
  ].filter((g) => g.people.length > 0);

  const show = (p: Participant) => filter === "all" || (filter === "present" ? p.checkedIn : !p.checkedIn);

  return (
    <div className="grid gap-8">
      <div className="grid gap-4 md:grid-cols-2">
        <CodeCard code={code} />
        <section aria-labelledby="att-rate" className="border border-fg/15 p-5">
          <Label id="att-rate">출석률</Label>
          <p className="mt-2 text-4xl font-bold tabular-nums">
            {total ? Math.round((present / total) * 100) : 0}%
          </p>
          <p className="mt-1 text-sm text-fg/60">
            {total}명 중 {present}명 출석 · 미출석 {total - present}명
          </p>
          <div className="mt-4">
            <RankBar value={present} max={total} />
          </div>
        </section>
      </div>

      <section aria-labelledby="att-list">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Label id="att-list">팀별 출석</Label>
          <div className="flex gap-1" role="group" aria-label="출석 필터">
            {(
              [
                ["all", "전체"],
                ["absent", "미출석"],
                ["present", "출석"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
                className={`border px-3 py-1.5 text-sm transition ${filter === k ? "border-fg bg-fg text-page" : "border-fg/20 text-fg/70 hover:border-fg/50"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {groups.map((g) => {
            const shown = g.people.filter(show);
            const here = g.people.filter((p) => p.checkedIn).length;
            if (shown.length === 0) return null;
            return (
              <div key={g.key} className="border border-fg/15">
                <div className="flex items-center justify-between gap-3 border-b border-fg/10 px-4 py-3">
                  <p className="min-w-0 truncate font-bold">{g.title}</p>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums text-xs text-fg/50">
                      {here}/{g.people.length}
                    </span>
                    {here < g.people.length && (
                      <button
                        type="button"
                        onClick={() => run(() => act.setCheckedIn(g.people.map((p) => p.id), true))}
                        className={`${smallBtn} px-2 py-1 text-xs`}
                      >
                        전원 출석
                      </button>
                    )}
                  </span>
                </div>
                <ul>
                  {shown.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 border-b border-fg/5 px-4 py-2 last:border-b-0">
                      <span className="flex min-w-0 items-center gap-2 text-sm">
                        <SchoolChip s={school(p.school)} className="h-3 w-3" />
                        <span className="truncate">{p.name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <Status on={p.checkedIn} />
                        <button
                          type="button"
                          onClick={() => run(() => act.setCheckedIn([p.id], !p.checkedIn))}
                          className={`${smallBtn} w-20 px-2 py-1 text-xs`}
                        >
                          {p.checkedIn ? "출석 취소" : "출석 처리"}
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function CodeCard({ code }: { code: string }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [run, pending] = useRun();

  return (
    <section aria-labelledby={`${id}-title`} className="border border-fg/15 bg-fg/[0.04] p-5">
      <Label id={`${id}-title`}>출석 코드</Label>
      <p className="mt-2 tabular-nums text-5xl font-bold tracking-[0.3em]">{code}</p>
      <p className="mt-1 text-xs text-fg/50">현장 화면에 띄워 주세요. 참가자는 이 코드를 직접 입력해야 출석됩니다.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.length === 4) run(() => act.setAttendanceCode(value), () => setValue(""));
        }}
        className="mt-4 flex flex-wrap gap-2"
      >
        <label htmlFor={`${id}-new`} className="sr-only">
          새 출석 코드
        </label>
        <input
          id={`${id}-new`}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          maxLength={4}
          placeholder="새 코드"
          autoComplete="off"
          className="w-28 border border-fg/20 bg-fg/[0.04] px-3 py-2 text-center tabular-nums tracking-[0.3em] text-fg outline-none placeholder:tracking-normal placeholder:text-fg/30 focus:border-fg/60"
        />
        <button type="submit" disabled={value.length < 4 || pending} className={primaryBtn}>
          변경
        </button>
        <button type="button" onClick={() => run(() => act.randomAttendanceCode())} disabled={pending} className={smallBtn}>
          랜덤 생성
        </button>
      </form>
    </section>
  );
}

/* ---------- 투자 현황 / 발행 ---------- */

function InvestStatusPanel({ state }: { state: FestivalState }) {
  const [run, pending] = useRun();
  const live = liveTotals(state);
  const snap = latestTick(state);
  const rows = state.teams
    .map((t) => ({ team: t, total: live.totals[t.id] ?? 0, investors: live.investors[t.id] ?? 0 }))
    .sort((a, b) => b.total - a.total);
  const top = rows[0]?.total ?? 0;
  const grand = rows.reduce((s, r) => s + r.total, 0);
  const pool = state.participants.reduce((sum, p) => sum + budgetOf(state, p.id), 0);
  const changed = !snap || state.teams.some((t) => (snap.totals[t.id] ?? 0) !== (live.totals[t.id] ?? 0));
  const nameOf = (pid: string) => state.participants.find((p) => p.id === pid)?.name;

  return (
    <div className="grid gap-8">
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="pool" className="border border-fg/15 p-5">
          <Label id="pool">전체 투자금</Label>
          <p className="mt-2 text-3xl font-bold tabular-nums">{won(grand)}</p>
          <p className="mt-1 text-sm text-fg/60">
            발행 가능 총액 {won(pool)} 중 {pool ? Math.round((grand / pool) * 100) : 0}% 투자됨
          </p>
          <div className="mt-4">
            <RankBar value={grand} max={pool} />
          </div>
        </section>

        <section aria-labelledby="publish" className="border border-fg/15 bg-fg/[0.04] p-5">
          <div className="flex items-center justify-between gap-3">
            <Label id="publish">참가자 화면 발행</Label>
            <span className="tabular-nums text-xs text-fg/50">틱 {state.ticks.length}개</span>
          </div>
          <p className="mt-2 text-lg font-bold">{snap ? `최근 발행 ${timeLabel(snap.at)}` : "아직 발행하지 않았습니다"}</p>
          <p role="status" className="mt-1 flex items-center gap-2 text-sm text-fg/60">
            {snap && changed && <span className="h-2 w-2 shrink-0 bg-[var(--g-yellow)]" aria-hidden="true" />}
            {!snap
              ? "발행해야 참가자들이 투자 현황을 볼 수 있습니다."
              : changed
                ? "발행 이후 투자 변동이 있습니다."
                : "현재 현황과 발행본이 같습니다."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => run(() => act.publishTick())}
              disabled={!changed || pending}
              className={`${primaryBtn} px-5 py-2.5 text-base`}
            >
              새 틱 발행하기
            </button>
            {snap && (
              <DeleteButton
                label="최근 틱 삭제"
                onConfirm={() => run(() => act.deleteLatestTick())}
              />
            )}
          </div>
          <p className="mt-2 text-xs text-fg/40">
            발행할 때마다 틱이 하나씩 쌓이고, 참가자는 발행된 틱들만 그래프로 볼 수 있습니다. 삭제는 가장 최근 틱만 지웁니다.
          </p>
        </section>
      </div>

      {/* Same view participants get on /onfestival — published ticks only */}
      <PublishedStatus state={state} admin />

      <section aria-labelledby="live-rank">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-4">
          <Label id="live-rank">실시간 투자 현황</Label>
          <span className="tabular-nums text-xs text-fg/50">운영진 전용 · 확정된 투자만 집계</span>
        </div>
        <ol className="grid gap-px border border-fg/10 bg-fg/10">
          {rows.map(({ team: t, total, investors }, i) => {
            const pub = snap?.totals[t.id] ?? 0;
            const diff = total - pub;
            const backers = Object.entries(state.investments)
              .map(([pid, byTeam]) => ({ pid, amt: byTeam[t.id] ?? 0 }))
              .filter((x) => x.amt > 0 && nameOf(x.pid))
              .sort((a, b) => b.amt - a.amt);
            return (
              <li key={t.id} className="bg-page">
                <details className="group">
                  <summary className="grid cursor-pointer list-none grid-cols-[2rem_1fr_auto] items-center gap-x-4 gap-y-2 p-4 [&::-webkit-details-marker]:hidden">
                    <span className="tabular-nums text-lg font-bold text-fg/60">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{t.project || "프로젝트 미정"}</span>
                      <span className="block truncate text-xs text-fg/50">
                        {t.name} · 투자자 {investors}명
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-bold tabular-nums">{won(total)}</span>
                      {snap && diff !== 0 && (
                        <span className="block tabular-nums text-xs text-fg/50">
                          발행 대비 {diff > 0 ? "+" : "−"}
                          {won(Math.abs(diff))}
                        </span>
                      )}
                    </span>
                    <span className="col-span-2 col-start-2">
                      <RankBar value={total} max={top} />
                    </span>
                  </summary>
                  <div className="border-t border-fg/10 px-4 py-3 pl-16">
                    {backers.length === 0 ? (
                      <p className="text-sm text-fg/50">아직 투자한 참가자가 없습니다.</p>
                    ) : (
                      <ul className="grid gap-1 text-sm sm:grid-cols-2">
                        {backers.map((b) => (
                          <li key={b.pid} className="flex justify-between gap-3">
                            <span>{nameOf(b.pid)}</span>
                            <span className="tabular-nums text-fg/70">{won(b.amt)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-xs text-fg/40">항목을 누르면 투자한 참가자를 볼 수 있습니다.</p>
      </section>
    </div>
  );
}
