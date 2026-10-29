"use client";

// Admin screen (/organize): participants, teams, attendance, budgets, live
// investment status and publishing ticks. All data comes from Supabase.

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { schools } from "./brand";
import { ContentPanel } from "./content-editor";
import { type Participant, type SchoolKey, type Team } from "@/data/guide";
import {
  budgetOf,
  buildState,
  investedBy,
  latestTick,
  liveTotals,
  membersOf,
  timeLabel,
  won,
  type FestivalState,
} from "@/lib/festival-store";
import {
  keys,
  patch as optimisticPatch,
  queryClient,
  run,
  useInvestSettings,
  useInvestments,
  useStaffEmails,
  usePeople,
  useTeams,
  useTicks,
  useVenueCode,
} from "@/lib/db/hooks";
import {
  addParticipant,
  addTeam,
  deleteParticipant,
  deleteTeam,
  deleteTick,
  publishTick,
  setAttendance,
  setBudgets as saveBudgets,
  setInvestSettings,
  addStaffEmail,
  normalizeEmail,
  removeStaffEmail,
  updateStaffNote,
  setVenueCode,
  updateParticipant,
  updateTeam,
  type PersonPatch,
  type TeamPatch,
} from "@/lib/db/queries";
import { signInWithGoogle, staffSignOut, useStaffSession } from "@/lib/staff-session";
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
  { id: "content", label: "행사 정보" },
  { id: "staff", label: "운영진" },
] as const;

/* ---------- Writes ---------- */
// Participants and teams go to Supabase; investment data in the mock store is
// cleaned up alongside so it never points at a removed person or team.

const setParticipant = (id: string, patch: PersonPatch) => run(() => updateParticipant(id, patch), optimisticPatch.person(id, patch));

// Investments, budgets and ticks are cleaned up by the database: rows cascade
// on delete, and moving someone into a team drops their investment in it.
const removeParticipant = (id: string) => run(() => deleteParticipant(id), optimisticPatch.removePerson(id));

const assignTeam = (id: string, teamId: string | null) =>
  run(() => updateParticipant(id, { teamId }), optimisticPatch.person(id, { teamId }));

type BudgetCfg = Pick<FestivalState, "step" | "defaultBudget">;

// Rounded to the step; a budget equal to the default is stored as "no override"
function setBudgets(cfg: BudgetCfg, ids: string[], amount: number) {
  const v = Math.max(0, Math.round(amount / cfg.step) * cfg.step);
  const stored = v === cfg.defaultBudget ? null : v;
  return run(() => saveBudgets(ids, stored), optimisticPatch.budgets(ids, stored));
}

const setTeam = (id: string, patch: TeamPatch) => run(() => updateTeam(id, patch), optimisticPatch.team(id, patch));

const removeTeam = (id: string) => run(() => deleteTeam(id), optimisticPatch.removeTeam(id));

/* ---------- Screen ---------- */

// Staff gate: Google sign-in, then the email must be on the staff_emails whitelist.
// The panels themselves still run on the localStorage mock.
export function AdminScreen() {
  const session = useStaffSession();
  if (session.status === "in") return <AdminPanels email={session.email} />;

  return (
    <ScreenFrame badge="운영진" tabs={NO_TABS} active="" onTab={() => {}}>
      {session.status === "loading" ? (
        <p className="py-10 text-fg/50" role="status">
          불러오는 중…
        </p>
      ) : (
        <StaffLogin denied={session.status === "denied" ? session.email : null} />
      )}
    </ScreenFrame>
  );
}

const NO_TABS: readonly { id: ""; label: string }[] = [];

function subscribeNothing() {
  return () => {};
}

function StaffLogin({ denied }: { denied: string | null }) {
  const [busy, setBusy] = useState(false);
  const failed = useSyncExternalStore(
    subscribeNothing,
    () => new URLSearchParams(window.location.search).has("login_error"),
    () => false,
  );

  return (
    <section aria-labelledby="staff-login" className="mx-auto max-w-md border border-fg/15 p-6 sm:p-8">
      <Label id="staff-login">운영진 로그인</Label>
      {denied ? (
        <>
          <p className="mt-3 text-2xl font-bold tracking-tight">접근 권한이 없습니다</p>
          <p className="mt-2 text-sm text-fg/60">
            <span className="font-bold text-fg">{denied}</span> 계정은 운영진 목록에 없습니다. 다른 계정으로 로그인하거나 운영진 관리자에게
            추가를 요청해 주세요.
          </p>
          <button type="button" className={`${primaryBtn} mt-6 w-full py-3 text-base`} onClick={() => void staffSignOut()}>
            다른 계정으로 로그인
          </button>
        </>
      ) : (
        <>
          <p className="mt-3 text-2xl font-bold tracking-tight">Google 계정으로 로그인</p>
          <p className="mt-1 text-sm text-fg/60">운영진으로 등록된 Google 계정만 들어올 수 있습니다.</p>
          {failed && (
            <p role="alert" className="mt-4 text-sm font-bold text-[var(--g-red)]">
              로그인에 실패했습니다. 다시 시도해 주세요.
            </p>
          )}
          <button
            type="button"
            disabled={busy}
            className={`${primaryBtn} mt-6 w-full py-3 text-base`}
            onClick={() => {
              setBusy(true);
              void signInWithGoogle();
            }}
          >
            {busy ? "Google로 이동 중…" : "Google로 로그인"}
          </button>
          <p className="mt-4 text-xs text-fg/50">참가자 입장 중인 브라우저라면 참가자 로그인은 로그아웃됩니다.</p>
        </>
      )}
    </section>
  );
}

function AdminPanels({ email }: { email: string }) {
  const people = usePeople("staff");
  const teams = useTeams("staff");
  const settings = useInvestSettings("staff");
  const investments = useInvestments("staff");
  const ticks = useTicks("staff");
  const [view, setView] = useHashTab(VIEWS, "people");
  const failed = people.error ?? teams.error ?? settings.error ?? investments.error ?? ticks.error;

  const state = useMemo(
    () => buildState(people.data, teams.data, settings.data, investments.data, ticks.data),
    [people.data, teams.data, settings.data, investments.data, ticks.data],
  );

  return (
    <ScreenFrame
      badge="운영진"
      tabs={VIEWS}
      active={view}
      onTab={setView}
      actions={
        <>
          <button
            type="button"
            onClick={() => void staffSignOut()}
            title={`${email}로 로그인됨`}
            className="inline-flex h-10 items-center border border-fg/25 px-3 text-sm font-bold transition hover:bg-fg/10"
          >
            로그아웃
          </button>
        </>
      }
    >
      {state ? (
        <Panels state={state} view={view} email={email} />
      ) : failed ? (
        <p role="alert" className="py-10 text-[var(--g-red)]">
          데이터를 불러오지 못했습니다. {failed.message}
        </p>
      ) : (
        <p className="py-10 text-fg/50" role="status">
          불러오는 중…
        </p>
      )}
    </ScreenFrame>
  );
}

function Panels({ state, view, email }: { state: FestivalState; view: (typeof VIEWS)[number]["id"]; email: string }) {
  const present = state.participants.filter((p) => p.checkedIn).length;
  const investors = state.participants.filter((p) => Object.values(state.investments[p.id] ?? {}).some((v) => v > 0)).length;

  return (
    <>
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

      {view === "people" && <PeoplePanel state={state} />}
      {view === "teams" && <TeamsPanel state={state} />}
      {view === "attendance" && <AttendancePanel state={state} />}
      {view === "budget" && <BudgetPanel state={state} />}
      {view === "invest" && <InvestStatusPanel state={state} />}
      {view === "content" && <ContentPanel />}
      {view === "staff" && <StaffPanel me={email} />}
    </>
  );
}

// Two-step delete so a stray click doesn't remove anything
function DeleteButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [arm, setArm] = useState(false);
  return arm ? (
    <span className="inline-flex gap-1">
      <button
        type="button"
        onClick={onConfirm}
        className="border border-[var(--g-red)] px-2.5 py-1.5 text-sm font-bold text-[var(--g-red)]"
      >
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
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={`${selectCls} max-w-[12rem]`}
    >
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

function PeoplePanel({ state }: { state: FestivalState }) {
  const id = useId();
  const [q, setQ] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const query = q.trim().toLowerCase();
  const teamName = (tid: string | null) => state.teams.find((t) => t.id === tid)?.name ?? "";

  const rows = state.participants.filter(
    (p) =>
      (teamFilter === "all" || (teamFilter === "none" ? !p.teamId : p.teamId === teamFilter)) &&
      (!query || p.name.toLowerCase().includes(query) || teamName(p.teamId).toLowerCase().includes(query)),
  );
  const unassigned = state.participants.filter((p) => !p.teamId).length;

  return (
    <div className="grid gap-8">
      <AddParticipant teams={state.teams} />

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
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-t border-fg/15 text-left text-sm">
            <thead className="text-xs text-fg/50">
              <tr className="border-b border-fg/15">
                <th className="py-2 pr-3 font-normal">이름</th>
                <th className="py-2 pr-3 font-normal">학교</th>
                <th className="py-2 pr-3 font-normal">팀</th>
                <th className="py-2 pr-3 font-normal">출석</th>
                <th className="py-2 pr-3 font-normal">참가자 코드</th>
                <th className="py-2 font-normal">
                  <span className="sr-only">관리</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <PersonRow key={p.id} p={p} teams={state.teams} />
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="py-6 text-sm text-fg/50">조건에 맞는 참가자가 없습니다.</p>}
      </section>
    </div>
  );
}

function PersonRow({ p, teams }: { p: Participant; teams: Team[] }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [sch, setSch] = useState(p.school);

  async function save() {
    if (!name.trim()) return;
    if (await setParticipant(p.id, { name: name.trim(), school: sch })) setEditing(false);
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
        <TeamSelect label={`${p.name} 팀 배정`} teams={teams} value={p.teamId} onChange={(v) => assignTeam(p.id, v)} />
      </td>
      <td className="py-2.5 pr-3">
        <Status on={p.checkedIn} />
      </td>
      <td className="py-2.5 pr-3 tabular-nums tracking-wider">{p.accessCode}</td>
      <td className="py-2.5 text-right">
        <span className="inline-flex gap-1">
          {editing ? (
            <>
              <button type="button" onClick={save} className={primaryBtn}>
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
              <DeleteButton label={`${p.name} 삭제`} onConfirm={() => removeParticipant(p.id)} />
            </>
          )}
        </span>
      </td>
    </tr>
  );
}

const short = (n: number) => `${(n / 10_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만`;

function BudgetCell({ cfg, id, name, budget }: { cfg: BudgetCfg; id: string; name: string; budget: number }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null) void setBudgets(cfg, [id], Number(draft.replace(/\D/g, "")) || 0);
    setDraft(null);
  };
  const stepBtn = "grid h-8 w-7 shrink-0 place-items-center border border-fg/20 text-sm transition hover:bg-fg/10 disabled:opacity-25";

  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        <button
          type="button"
          aria-label={`${name} 투자금 ${won(cfg.step)} 줄이기`}
          disabled={budget <= 0}
          onClick={() => void setBudgets(cfg, [id], budget - cfg.step)}
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
          className={`h-8 w-24 border-y border-fg/20 bg-fg/[0.04] px-2 text-right text-xs tabular-nums text-fg outline-none focus:border-fg/60 ${budget !== cfg.defaultBudget ? "font-bold" : ""}`}
        />
        <button
          type="button"
          aria-label={`${name} 투자금 ${won(cfg.step)} 늘리기`}
          onClick={() => void setBudgets(cfg, [id], budget + cfg.step)}
          className={stepBtn}
        >
          +
        </button>
      </div>
    </div>
  );
}

function BulkBudget({ cfg, ids, filtered }: { cfg: BudgetCfg; ids: string[]; filtered: boolean }) {
  const fid = useId();
  const [value, setValue] = useState("");
  const amount = Number(value) || 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value) {
          void setBudgets(cfg, ids, amount);
          setValue("");
        }
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
        placeholder={cfg.defaultBudget.toLocaleString("ko-KR")}
        className="h-9 w-32 border border-fg/20 bg-fg/[0.04] px-2 text-right text-sm tabular-nums text-fg outline-none placeholder:text-fg/30 focus:border-fg/60"
      />
      <span className="text-sm text-fg/50">원</span>
      <button type="submit" disabled={!value || ids.length === 0} className={primaryBtn}>
        {filtered ? `표시된 ${ids.length}명에게 적용` : `전체 ${ids.length}명에게 적용`}
      </button>
      <button type="button" onClick={() => void setBudgets(cfg, ids, cfg.defaultBudget)} disabled={ids.length === 0} className={smallBtn}>
        기본값({short(cfg.defaultBudget)}원)으로
      </button>
      <span className="text-xs text-fg/40">{won(cfg.step)} 단위로 맞춰집니다.</span>
    </form>
  );
}

/* ---------- 투자금 관리 ---------- */

// The default applies to everyone without a personal budget
function DefaultBudget({ cfg }: { cfg: BudgetCfg }) {
  const id = useId();
  const [value, setValue] = useState("");
  const amount = Math.max(0, Math.round((Number(value) || 0) / cfg.step) * cfg.step);

  return (
    <section aria-labelledby={`${id}-title`} className="border border-fg/15 bg-fg/[0.04] p-5">
      <Label id={`${id}-title`}>기본 투자금</Label>
      <p className="mt-2 text-3xl font-bold tabular-nums">{won(cfg.defaultBudget)}</p>
      <p className="mt-1 text-xs text-fg/50">개인 투자금을 따로 정하지 않은 모든 참가자에게 적용됩니다. 투자 단위 {won(cfg.step)}.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!value) return;
          if (await run(() => setInvestSettings({ defaultBudget: amount }), optimisticPatch.investSettings({ defaultBudget: amount })))
            setValue("");
        }}
        className="mt-4 flex flex-wrap items-center gap-2"
      >
        <label htmlFor={`${id}-amt`} className="sr-only">
          새 기본 투자금
        </label>
        <input
          id={`${id}-amt`}
          inputMode="numeric"
          autoComplete="off"
          value={value ? Number(value).toLocaleString("ko-KR") : ""}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          placeholder={cfg.defaultBudget.toLocaleString("ko-KR")}
          className="h-9 w-36 border border-fg/20 bg-page px-2 text-right text-sm tabular-nums text-fg outline-none placeholder:text-fg/30 focus:border-fg/60"
        />
        <span className="text-sm text-fg/50">원</span>
        <button type="submit" disabled={!value || amount === cfg.defaultBudget} className={primaryBtn}>
          기본값 변경
        </button>
      </form>
    </section>
  );
}

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
  const custom = all.filter((r) => r.budget !== state.defaultBudget).length;

  return (
    <div className="grid gap-8">
      <DefaultBudget cfg={state} />

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

        <BulkBudget cfg={state} ids={rows.map((r) => r.p.id)} filtered={rows.length !== all.length} />

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
                    <BudgetCell cfg={state} id={p.id} name={p.name} budget={budget} />
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
        <p className="mt-3 text-xs text-fg/40">이미 확정한 금액보다 낮추면 해당 참가자는 금액을 줄이기 전까지 다시 확정할 수 없습니다.</p>
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
  const [added, setAdded] = useState<{ name: string; code: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("이름을 입력해 주세요.");
    setBusy(true);
    let code = "";
    const done = await run(async () => {
      code = await addParticipant({ name: name.trim(), school: sch, teamId });
    });
    setBusy(false);
    if (!done) return;
    setAdded({ name: name.trim(), code });
    setName("");
    setError("");
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
        <button type="submit" disabled={busy} className={`${primaryBtn} h-[2.4rem]`}>
          {busy ? "추가 중…" : "추가"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--g-red)]">
          {error}
        </p>
      )}
      {added && (
        <p role="status" className="mt-3 text-sm">
          {added.name}님을 추가했습니다. 참가자 코드 <span className="tabular-nums text-base font-bold tracking-wider">{added.code}</span>를
          전달해 주세요.
        </p>
      )}
    </form>
  );
}

/* ---------- 팀 관리 ---------- */

function TeamsPanel({ state }: { state: FestivalState }) {
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
                <TeamSelect label={`${p.name} 팀 배정`} teams={state.teams} value={null} onChange={(v) => assignTeam(p.id, v)} />
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

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const saved = await setTeam(team.id, {
      name: form.name.trim(),
      table: form.table.trim(),
      project: form.project.trim(),
      desc: form.desc.trim(),
    });
    if (saved) setEditing(false);
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
              <button type="submit" className={primaryBtn}>
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
                <DeleteButton label={`${team.name} 삭제`} onConfirm={() => removeTeam(team.id)} />
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
                      onClick={() => assignTeam(m.id, null)}
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

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("팀명을 입력해 주세요.");
    const done = await run(() => addTeam({ name: name.trim(), table: table.trim(), project: project.trim(), desc: "" }));
    if (!done) return;
    setName("");
    setTable("");
    setProject("");
    setError("");
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
          <input
            id={`${id}-table`}
            value={table}
            onChange={(e) => setTable(e.target.value)}
            placeholder="D-01"
            className={`${fieldCls} py-2`}
          />
        </label>
        <label htmlFor={`${id}-project`} className="min-w-[10rem] flex-1 text-xs text-fg/60">
          프로젝트명
          <input id={`${id}-project`} value={project} onChange={(e) => setProject(e.target.value)} className={`${fieldCls} py-2`} />
        </label>
        <button type="submit" className={`${primaryBtn} h-[2.4rem]`}>
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

function AttendancePanel({ state }: { state: FestivalState }) {
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
        <CodeCard />
        <section aria-labelledby="att-rate" className="border border-fg/15 p-5">
          <Label id="att-rate">출석률</Label>
          <p className="mt-2 text-4xl font-bold tabular-nums">{total ? Math.round((present / total) * 100) : 0}%</p>
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
                        onClick={() => {
                          const ids = g.people.filter((p) => !p.checkedIn).map((p) => p.id);
                          void run(() => setAttendance(ids, true), optimisticPatch.attendance(ids, true));
                        }}
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
                          onClick={() =>
                            void run(() => setAttendance([p.id], !p.checkedIn), optimisticPatch.attendance([p.id], !p.checkedIn))
                          }
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

function CodeCard() {
  const id = useId();
  const [value, setValue] = useState("");
  const venue = useVenueCode();
  const code = venue.isPending ? "····" : (venue.data ?? "닫힘");

  async function apply(next: string | null) {
    if (await run(() => setVenueCode(next), optimisticPatch.venueCode(next))) setValue("");
  }

  return (
    <section aria-labelledby={`${id}-title`} className="border border-fg/15 bg-fg/[0.04] p-5">
      <Label id={`${id}-title`}>출석 코드</Label>
      <p className="mt-2 tabular-nums text-5xl font-bold tracking-[0.3em]">{code}</p>
      <p className="mt-1 text-xs text-fg/50">현장 화면에 띄워 주세요. 바꾸면 바로 적용됩니다.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.length === 4) apply(value);
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
        <button type="submit" disabled={value.length < 4} className={primaryBtn}>
          변경
        </button>
        <button type="button" onClick={() => apply(String(Math.floor(Math.random() * 10000)).padStart(4, "0"))} className={smallBtn}>
          랜덤 생성
        </button>
        {venue.data && (
          <button type="button" onClick={() => apply(null)} className={smallBtn} title="코드를 지우면 참가자가 출석할 수 없습니다">
            출석 닫기
          </button>
        )}
      </form>
    </section>
  );
}

/* ---------- 투자 현황 / 발행 ---------- */

// One publish at a time. The flag is module-level and set synchronously, so a
// double click (both clicks land before React re-renders the disabled button)
// still sends a single request. It's released only after the new tick has
// been refetched, so the button can't re-enable on stale data in between.
// publish_tick() also serializes on the server and refuses a duplicate tick.
let publishInFlight = false;
const publishListeners = new Set<() => void>();
const setPublishInFlight = (v: boolean) => {
  publishInFlight = v;
  publishListeners.forEach((l) => l());
};

function usePublishing() {
  return useSyncExternalStore(
    (cb) => {
      publishListeners.add(cb);
      return () => publishListeners.delete(cb);
    },
    () => publishInFlight,
    () => false,
  );
}

async function publishOnce() {
  if (publishInFlight) return;
  setPublishInFlight(true);
  try {
    if (await run(publishTick)) await queryClient.refetchQueries({ queryKey: keys.ticks });
  } finally {
    setPublishInFlight(false);
  }
}

// Staff open and close investing; while closed, participants can't confirm
function InvestOpen({ open }: { open: boolean }) {
  const next = !open;
  return (
    <section
      aria-labelledby="invest-open"
      className={`flex flex-wrap items-center justify-between gap-3 border p-4 ${open ? "border-fg/15" : "border-[var(--g-red)]/60 bg-[var(--g-red)]/[0.06]"}`}
    >
      <div>
        <Label id="invest-open">투자 접수</Label>
        <p className="mt-1 text-lg font-bold">
          <span
            className={`mr-2 inline-block h-2.5 w-2.5 align-middle ${open ? "bg-[var(--g-green)]" : "bg-[var(--g-red)]"}`}
            aria-hidden="true"
          />
          {open ? "열림 · 참가자가 투자를 확정할 수 있습니다" : "닫힘 · 참가자는 투자를 바꿀 수 없습니다"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void run(() => setInvestSettings({ open: next }), optimisticPatch.investSettings({ open: next }))}
        className={open ? smallBtn : primaryBtn}
      >
        {open ? "투자 마감하기" : "투자 다시 열기"}
      </button>
    </section>
  );
}

function InvestStatusPanel({ state }: { state: FestivalState }) {
  const publishing = usePublishing();
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
      <InvestOpen open={state.investOpen} />

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
              onClick={() => void publishOnce()}
              disabled={!changed || publishing}
              className={`${primaryBtn} px-5 py-2.5 text-base`}
            >
              {publishing ? "발행 중…" : "새 틱 발행하기"}
            </button>
            {snap?.id !== undefined && (
              <DeleteButton
                label="최근 틱 삭제"
                onConfirm={() => void run(() => deleteTick(snap.id!), optimisticPatch.removeTick(snap.id!))}
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

/* ---------- 운영진 (staff whitelist) ---------- */

// Every staff member can add and remove staff, except themselves (the
// database refuses removing your own email so nobody locks themselves out).
function StaffPanel({ me }: { me: string }) {
  const id = useId();
  const staff = useStaffEmails();
  const mine = normalizeEmail(me);

  return (
    <div className="grid gap-8">
      <AddStaff />

      <section aria-labelledby={`${id}-title`}>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <Label id={`${id}-title`}>운영진 목록</Label>
          <span className="text-xs tabular-nums text-fg/50">{staff.data ? `${staff.data.length}명` : ""}</span>
        </div>
        {staff.isPending ? (
          <p className="py-6 text-sm text-fg/50" role="status">
            불러오는 중…
          </p>
        ) : staff.error ? (
          <p role="alert" className="py-6 text-sm text-[var(--g-red)]">
            목록을 불러오지 못했습니다. {staff.error.message}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-t border-fg/15 text-left text-sm">
              <thead className="text-xs text-fg/50">
                <tr className="border-b border-fg/15">
                  <th className="py-2 pr-3 font-normal">이메일</th>
                  <th className="py-2 pr-3 font-normal">메모</th>
                  <th className="py-2 pr-3 font-normal">추가한 사람</th>
                  <th className="py-2 font-normal">
                    <span className="sr-only">관리</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {staff.data.map((s) => {
                  const self = s.email === mine;
                  return (
                    <tr key={s.email} className="border-b border-fg/10 align-middle">
                      <td className="py-2.5 pr-3">
                        <span className="font-bold">{s.email}</span>
                        {self && <span className="ml-2 bg-fg px-1.5 py-0.5 text-[11px] font-bold text-page">나</span>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <StaffNote email={s.email} note={s.note} />
                      </td>
                      <td className="py-2.5 pr-3 text-fg/60">
                        {s.addedBy ?? "—"}
                        <span className="block text-xs tabular-nums text-fg/40">{timeLabel(s.createdAt)}</span>
                      </td>
                      <td className="py-2.5 text-right">
                        {self ? (
                          <span className="text-xs text-fg/40" title="본인 이메일은 삭제할 수 없습니다">
                            본인
                          </span>
                        ) : (
                          <DeleteButton
                            label={`${s.email} 운영진에서 삭제`}
                            onConfirm={() => void run(() => removeStaffEmail(s.email), optimisticPatch.removeStaffEmail(s.email))}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-fg/40">
          삭제된 사람은 다음 요청부터 운영진 화면을 쓸 수 없습니다. 본인 이메일은 다른 운영진만 삭제할 수 있습니다.
        </p>
      </section>
    </div>
  );
}

// Saves 600 ms after the last keystroke, or right away on blur / Enter
const NOTE_DEBOUNCE = 600;

function StaffNote({ email, note }: { email: string; note: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancel, []);

  function save(value: string) {
    cancel();
    const v = value.trim();
    // Keep the draft if the user typed more while this save was in flight
    const settle = () => setDraft((d) => (d === value ? null : d));
    if (v === note) return settle();
    void run(() => updateStaffNote(email, v), optimisticPatch.staffNote(email, v)).then(settle);
  }

  return (
    <input
      aria-label={`${email} 메모`}
      value={draft ?? note}
      onChange={(e) => {
        const value = e.target.value;
        setDraft(value);
        cancel();
        timer.current = setTimeout(() => save(value), NOTE_DEBOUNCE);
      }}
      onBlur={() => draft !== null && save(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancel();
          setDraft(null);
        }
      }}
      placeholder="메모"
      className={`${fieldCls} mt-0 py-1.5`}
    />
  );
}

function AddStaff() {
  const id = useId();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return setError("이메일 형식을 확인해 주세요.");
    setBusy(true);
    const done = await run(() => addStaffEmail(v, note));
    setBusy(false);
    if (!done) return;
    setEmail("");
    setNote("");
    setError("");
  }

  return (
    <form onSubmit={submit} noValidate className="border border-fg/15 p-5">
      <Label>운영진 추가</Label>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label htmlFor={`${id}-email`} className="min-w-[14rem] flex-1 text-xs text-fg/60">
          Google 계정 이메일
          <input
            id={`${id}-email`}
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            placeholder="name@gmail.com"
            className={`${fieldCls} py-2`}
          />
        </label>
        <label htmlFor={`${id}-note`} className="min-w-[10rem] flex-1 text-xs text-fg/60">
          메모
          <input
            id={`${id}-note`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="이름, 학교 등"
            className={`${fieldCls} py-2`}
          />
        </label>
        <button type="submit" disabled={busy} className={`${primaryBtn} h-[2.4rem]`}>
          {busy ? "추가 중…" : "추가"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--g-red)]">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-fg/40">추가된 사람은 이 이메일의 Google 계정으로 /organize에 로그인할 수 있습니다.</p>
    </form>
  );
}
