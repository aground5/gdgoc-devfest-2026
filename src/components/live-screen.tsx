"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { GdgLogo, GoogleBar, schools, type School } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import {
  ATTENDANCE_CODE,
  INVEST_BUDGET,
  INVEST_STEP,
  event,
  myTeamId,
  teams as initialTeams,
  type SchoolKey,
  type Team,
} from "@/data/guide";

// Mockup: all state is local and resets on reload.

/* ---------- Helpers ---------- */

const school = (key: SchoolKey) => schools.find((s) => s.key === key) as School;

// Schools represented on a team, in the standard school order
const teamSchools = (t: Team) => schools.filter((s) => t.members.some((m) => m.school === s.key));

/* ---------- Live screen ---------- */

const VIEWS = [
  { id: "team", label: "내 팀" },
  { id: "invest", label: "투자" },
] as const;

type View = (typeof VIEWS)[number]["id"];

export function LiveScreen() {
  const [teams, setTeams] = useState(initialTeams);
  const [view, setView] = useState<View>("team");
  const [invest, setInvest] = useState<Record<string, number>>({});
  // Last confirmed amounts; null until the first confirm. Confirming doesn't lock anything.
  const [saved, setSaved] = useState<Record<string, number> | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();
  const myTeam = teams.find((t) => t.id === myTeamId) as Team;

  function updateMyTeam(patch: Partial<Team>) {
    setTeams((all) => all.map((t) => (t.id === myTeamId ? { ...t, ...patch } : t)));
  }

  function onTabKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = VIEWS.findIndex((v) => v.id === view);
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + VIEWS.length) % VIEWS.length;
    setView(VIEWS[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="flex min-h-svh flex-col bg-page text-fg">
      <header className="sticky top-0 z-10 border-b border-fg/10 bg-page">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-4 sm:px-8">
          <p className="flex items-center gap-2 text-sm font-semibold sm:text-base">
            <GdgLogo className="h-3 w-6" />
            {event.series}
            <span className="hidden text-fg/40 sm:inline">· {event.theme}</span>
          </p>
          <div className="flex items-center gap-2">
            <ThemeToggle className="h-10 w-10" />
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 border border-fg/25 px-4 text-sm font-semibold transition hover:bg-fg/10"
            >
              나가기 <span aria-hidden="true">✕</span>
            </Link>
          </div>
        </div>
        <div role="tablist" aria-label="대회 메뉴" onKeyDown={onTabKey} className="mx-auto flex max-w-6xl gap-1 px-4 sm:px-8">
          {VIEWS.map((v, i) => {
            const on = v.id === view;
            return (
              <button
                key={v.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                id={`${base}-tab-${v.id}`}
                aria-selected={on}
                aria-controls={`${base}-panel`}
                tabIndex={on ? 0 : -1}
                onClick={() => setView(v.id)}
                className={`relative px-3 py-3 text-sm font-semibold transition sm:text-base ${on ? "text-fg" : "text-fg/50 hover:text-fg/80"}`}
              >
                {v.label}
                {on && <span className="absolute inset-x-3 bottom-0 h-[3px] bg-fg" />}
              </button>
            );
          })}
        </div>
      </header>

      <div
        role="tabpanel"
        id={`${base}-panel`}
        aria-labelledby={`${base}-tab-${view}`}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-10"
      >
        {view === "team" ? (
          <div className="grid gap-10 lg:grid-cols-[1fr_26rem]">
            <div className="grid content-start gap-6">
              <MyTeamCard team={myTeam} onSave={updateMyTeam} />
              <AttendanceCard team={myTeam} onCheckIn={() => updateMyTeam({ checkedIn: true })} />
            </div>
            <TeamList teams={teams} />
          </div>
        ) : (
          <InvestPanel
            teams={teams}
            amounts={invest}
            saved={saved}
            onChange={(id, v) => setInvest((all) => ({ ...all, [id]: v }))}
            onConfirm={() => setSaved({ ...invest })}
          />
        )}
      </div>

      <GoogleBar horizontal className="h-1.5 shrink-0" />
    </div>
  );
}

/* ---------- Shared bits ---------- */

function Label({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-fg/60">
      {children}
    </h2>
  );
}

function SchoolChip({ s, className = "h-4 w-4" }: { s: School; className?: string }) {
  return (
    <span className={`flex shrink-0 ${className}`} title={s.name}>
      <span className="flex-1" style={{ background: s.dark }} />
      <span className="flex-1" style={{ background: s.light }} />
    </span>
  );
}

function Status({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[var(--g-green)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--g-green)]" />
      출석
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-fg/40">
      <span className="h-1.5 w-1.5 rounded-full bg-fg/30" />
      미출석
    </span>
  );
}

const fieldCls =
  "mt-1.5 w-full border border-fg/20 bg-fg/[0.04] px-3 py-2.5 text-fg placeholder:text-fg/30 outline-none transition focus:border-fg/60";

const smallBtn = "border border-fg/25 px-3 py-1.5 text-sm font-semibold transition hover:bg-fg/10";

/* ---------- My team ---------- */

function MyTeamCard({ team, onSave }: { team: Team; onSave: (patch: Partial<Team>) => void }) {
  const [editing, setEditing] = useState(false);
  const mix = teamSchools(team);

  return (
    <section aria-labelledby="my-team" className="border border-fg/15 bg-fg/[0.04]">
      {/* One color pair per member, so a mixed team shows its mix */}
      <div className="flex h-2" aria-hidden="true">
        {team.members.map((m, i) => (
          <SchoolChip key={i} s={school(m.school)} className="h-full flex-1" />
        ))}
      </div>
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Label id="my-team">내 팀</Label>
            <p className="mt-2 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{team.name}</p>
            <p className="mt-1 text-sm text-fg/60">
              테이블 <span className="font-mono text-fg">{team.table}</span>
              {" · "}
              {mix.length > 1 ? `${mix.length}개 학교 연합` : `GDG on Campus ${mix[0]?.word ?? ""}`}
            </p>
          </div>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className={`shrink-0 ${smallBtn}`}>
              정보 수정
            </button>
          )}
        </div>

        {editing ? (
          <TeamForm
            team={team}
            onCancel={() => setEditing(false)}
            onSave={(patch) => {
              onSave(patch);
              setEditing(false);
            }}
          />
        ) : (
          <dl className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-fg/50">프로젝트</dt>
              <dd className="mt-1 text-lg font-semibold">{team.project || "—"}</dd>
              {team.desc && <dd className="mt-1 text-sm leading-relaxed text-fg/70">{team.desc}</dd>}
            </div>
            <div>
              <dt className="text-xs text-fg/50">팀원 {team.members.length}명</dt>
              <dd className="mt-2">
                <ul className="grid gap-1.5">
                  {team.members.map((m, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <SchoolChip s={school(m.school)} className="h-3 w-3" />
                      <span className="font-medium">{m.name}</span>
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
function TeamForm({
  team,
  onSave,
  onCancel,
}: {
  team: Team;
  onSave: (patch: Partial<Team>) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(team.name);
  const [project, setProject] = useState(team.project);
  const [desc, setDesc] = useState(team.desc);
  const [error, setError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("팀명을 입력해 주세요.");
    onSave({ name: name.trim(), project: project.trim(), desc: desc.trim() });
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
          {team.members.map((m, i) => (
            <li key={i} className="inline-flex items-center gap-2 border border-fg/15 px-2.5 py-1 text-sm text-fg/70">
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
        <button type="submit" className="bg-fg px-4 py-2 text-sm font-semibold text-page transition hover:opacity-85">
          저장
        </button>
        <button type="button" onClick={onCancel} className={smallBtn}>
          취소
        </button>
      </div>
    </form>
  );
}

/* ---------- Attendance ---------- */

function AttendanceCard({ team, onCheckIn }: { team: Team; onCheckIn: () => void }) {
  const id = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [at, setAt] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (code !== ATTENDANCE_CODE) {
      setError("출석 코드가 올바르지 않습니다. 운영진에게 다시 확인해 주세요.");
      return;
    }
    setError("");
    setAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
    onCheckIn();
  }

  return (
    <section aria-labelledby={`${id}-title`} className="border border-fg/15 p-5 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <Label id={`${id}-title`}>출석 체크</Label>
        <Status on={team.checkedIn} />
      </div>

      {team.checkedIn ? (
        <p className="mt-4 text-lg font-semibold">
          출석이 확인되었습니다{at && <span className="ml-2 font-mono text-sm font-normal text-fg/50">{at}</span>}
        </p>
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
              className="w-36 border border-fg/20 bg-fg/[0.04] px-3 py-2.5 text-center font-mono text-2xl tracking-[0.4em] text-fg outline-none transition placeholder:text-fg/20 focus:border-fg/60"
            />
            <button
              type="submit"
              disabled={code.length < 4}
              className="bg-fg px-5 font-semibold text-page transition hover:opacity-85 disabled:opacity-30"
            >
              출석하기
            </button>
          </div>
          {error && (
            <p id={`${id}-err`} role="alert" className="mt-2 text-sm text-[var(--g-red)]">
              {error}
            </p>
          )}
          <p className="mt-3 text-xs text-fg/40">목업용 코드: {ATTENDANCE_CODE}</p>
        </form>
      )}
    </section>
  );
}

/* ---------- All teams ---------- */

function TeamList({ teams }: { teams: Team[] }) {
  const id = useId();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const rows = teams.filter(
    (t) =>
      !query ||
      [t.name, t.project, t.table, ...t.members.map((m) => m.name)].some((v) => v.toLowerCase().includes(query)),
  );
  return (
    <section aria-labelledby={`${id}-title`}>
      <div className="flex items-baseline justify-between gap-4">
        <Label id={`${id}-title`}>참가 팀</Label>
        <span className="font-mono text-xs text-fg/50">
          {teams.length}팀
        </span>
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
        {rows.map((t) => {
          const mine = t.id === myTeamId;
          const mix = teamSchools(t);
          return (
            <li
              key={t.id}
              aria-current={mine ? "true" : undefined}
              className={`flex items-center gap-3 border-b border-fg/10 px-2 py-3 ${mine ? "bg-fg/[0.08] outline outline-1 outline-fg/40" : ""}`}
            >
              <span className="w-10 shrink-0 font-mono text-xs text-fg/50">{t.table}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold">{t.name}</span>
                  {mine && <span className="shrink-0 bg-fg px-1.5 py-0.5 text-[10px] font-bold text-page">MY</span>}
                </span>
                <span className="mt-1 flex items-center gap-2 text-xs text-fg/50">
                  <span className="flex gap-0.5" aria-label={mix.map((s) => s.word).join(", ")}>
                    {mix.map((s) => (
                      <SchoolChip key={s.key} s={s} className="h-2.5 w-2.5" />
                    ))}
                  </span>
                  <span className="truncate">
                    {t.project} · {t.members.length}명
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

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

function InvestPanel({
  teams,
  amounts,
  saved,
  onChange,
  onConfirm,
}: {
  teams: Team[];
  amounts: Record<string, number>;
  saved: Record<string, number> | null;
  onChange: (teamId: string, amount: number) => void;
  onConfirm: () => void;
}) {
  const targets = teams.filter((t) => t.id !== myTeamId);
  const used = targets.reduce((sum, t) => sum + (amounts[t.id] ?? 0), 0);
  const left = INVEST_BUDGET - used;
  const invested = targets.filter((t) => (amounts[t.id] ?? 0) > 0);
  const dirty = saved === null || targets.some((t) => (amounts[t.id] ?? 0) !== (saved[t.id] ?? 0));
  const upToDate = saved !== null && !dirty;

  return (
    <div className="grid gap-8">
      {/* Budget summary */}
      <section aria-labelledby="invest-summary" className="border border-fg/15 bg-fg/[0.04] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Label id="invest-summary">내 투자금</Label>
            <p className="mt-2 font-mono text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{won(left)}</p>
            <p className="mt-1 text-sm text-fg/60">
              남은 금액 · 총 {won(INVEST_BUDGET)} 중 {won(used)} 투자
            </p>
          </div>
          {upToDate ? (
            <span className="inline-flex items-center gap-2 border border-[var(--g-green)] px-4 py-2 text-sm font-semibold text-[var(--g-green)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--g-green)]" />
              확정됨
            </span>
          ) : (
            <button
              type="button"
              onClick={onConfirm}
              disabled={saved === null && used === 0}
              className="bg-fg px-5 py-2.5 font-semibold text-page transition hover:opacity-85 disabled:opacity-30"
            >
              {saved === null ? "투자 확정하기" : "변경사항 확정하기"}
            </button>
          )}
        </div>

        <div
          className="mt-6 flex h-3 gap-px bg-fg/10"
          role="meter"
          aria-label="투자금 사용률"
          aria-valuemin={0}
          aria-valuemax={INVEST_BUDGET}
          aria-valuenow={used}
        >
          {invested.map((t, i) => (
            <span
              key={t.id}
              className="h-full bg-fg"
              title={`${t.project} ${won(amounts[t.id])}`}
              style={{ width: `${(amounts[t.id] / INVEST_BUDGET) * 100}%`, opacity: i % 2 ? 0.55 : 0.9 }}
            />
          ))}
        </div>
        {saved !== null && dirty ? (
          <p role="status" className="mt-3 flex items-center gap-2 text-xs font-semibold text-fg">
            <span className="h-2 w-2 shrink-0 bg-[var(--g-yellow)]" aria-hidden="true" />
            확정 후 바뀐 내용이 있습니다. 다시 확정해야 반영됩니다.
          </p>
        ) : (
          <p role="status" className="mt-3 text-xs text-fg/40">
            {upToDate
              ? "확정된 투자입니다. 언제든 다시 바꾸고 확정할 수 있습니다."
              : `${won(INVEST_STEP)} 단위로 투자할 수 있습니다. 내 팀 프로젝트에는 투자할 수 없습니다.`}
          </p>
        )}
      </section>

      {/* Projects */}
      <section aria-labelledby="invest-projects">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <Label id="invest-projects">프로젝트</Label>
          <span className="font-mono text-xs text-fg/50">
            {targets.length}개 · 투자 {invested.length}
          </span>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {targets.map((t) => (
            <InvestCard
              key={t.id}
              team={t}
              amount={amounts[t.id] ?? 0}
              max={(amounts[t.id] ?? 0) + left}
              savedAmount={saved?.[t.id] ?? (saved ? 0 : undefined)}
              onChange={(v) => onChange(t.id, v)}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function InvestCard({
  team,
  amount,
  max,
  savedAmount,
  onChange,
}: {
  team: Team;
  amount: number;
  max: number;
  savedAmount?: number;
  onChange: (amount: number) => void;
}) {
  const id = useId();
  const set = (v: number) => onChange(Math.max(0, Math.min(max, v)));
  const changed = savedAmount !== undefined && savedAmount !== amount;
  const stepBtn =
    "grid h-11 w-11 shrink-0 place-items-center border border-fg/20 text-lg transition hover:bg-fg/10 disabled:opacity-25 disabled:hover:bg-transparent";

  return (
    <li className={`flex flex-col border ${amount > 0 ? "border-fg/50 bg-fg/[0.06]" : "border-fg/15"}`}>
      <div className="flex h-1.5" aria-hidden="true">
        {team.members.map((m, i) => (
          <SchoolChip key={i} s={school(m.school)} className="h-full flex-1" />
        ))}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="font-mono text-xs text-fg/50">
          {team.table} · {team.name}
        </p>
        <h3 className="mt-2 text-xl font-semibold leading-snug">{team.project}</h3>
        {team.desc && <p className="mt-1 text-sm leading-relaxed text-fg/60">{team.desc}</p>}

        <div className="mt-auto pt-5">
          <label htmlFor={`${id}-amt`} className="text-xs text-fg/50">
            투자 금액
          </label>
          <div className="mt-1.5 flex gap-1.5">
            <button
              type="button"
              aria-label={`${team.project} 투자금 ${won(INVEST_STEP)} 줄이기`}
              disabled={amount === 0}
              onClick={() => set(amount - INVEST_STEP)}
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
              onBlur={() => set(Math.round(amount / INVEST_STEP) * INVEST_STEP)}
              className="h-11 min-w-0 flex-1 border border-fg/20 bg-fg/[0.04] px-3 text-right font-mono text-lg tabular-nums text-fg outline-none transition placeholder:text-fg/25 focus:border-fg/60 disabled:opacity-60"
            />
            <button
              type="button"
              aria-label={`${team.project} 투자금 ${won(INVEST_STEP)} 늘리기`}
              disabled={amount >= max}
              onClick={() => set(amount + INVEST_STEP)}
              className={stepBtn}
            >
              +
            </button>
          </div>
          <p className="mt-2 flex justify-between gap-2 font-mono text-xs text-fg/40">
            <span className={`flex items-center gap-1.5 ${changed ? "text-fg/70" : ""}`}>
              {changed ? (
                <>
                  <span className="h-1.5 w-1.5 bg-[var(--g-yellow)]" aria-hidden="true" />
                  확정 {won(savedAmount)}
                </>
              ) : (
                "\u00a0"
              )}
            </span>
            <span>{amount > 0 ? `내 투자금의 ${Math.round((amount / INVEST_BUDGET) * 100)}%` : ""}</span>
          </p>
        </div>
      </div>
    </li>
  );
}
