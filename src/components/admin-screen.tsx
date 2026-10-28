"use client";

// Admin screen (/organize): participants, teams, attendance, live investment status,
// and publishing investment ticks (snapshots) that participants see.

import { useId, useState, type FormEvent } from "react";
import { schools } from "./brand";
import { INVEST_BUDGET, type Participant, type SchoolKey, type Team } from "@/data/guide";
import {
  latestTick,
  liveTotals,
  membersOf,
  resetFestival,
  timeLabel,
  updateFestival,
  useFestival,
  won,
  type FestivalState,
} from "@/lib/festival-store";
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
} from "./festival-ui";

const VIEWS = [
  { id: "people", label: "참가자" },
  { id: "teams", label: "팀" },
  { id: "attendance", label: "출석" },
  { id: "invest", label: "투자 현황" },
] as const;

type View = (typeof VIEWS)[number]["id"];

const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/* ---------- Store actions ---------- */

const setParticipant = (id: string, patch: Partial<Participant>) =>
  updateFestival((s) => ({ ...s, participants: s.participants.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

function removeParticipant(id: string) {
  updateFestival((s) => {
    const investments = { ...s.investments };
    delete investments[id];
    return { ...s, participants: s.participants.filter((p) => p.id !== id), investments };
  });
}

// Moving someone to a team drops any investment they made in that team.
function assignTeam(id: string, teamId: string | null) {
  updateFestival((s) => {
    const mine = s.investments[id];
    const investments = { ...s.investments };
    if (mine && teamId && mine[teamId]) {
      const rest = { ...mine };
      delete rest[teamId];
      investments[id] = rest;
    }
    return { ...s, investments, participants: s.participants.map((p) => (p.id === id ? { ...p, teamId } : p)) };
  });
}

const setTeam = (id: string, patch: Partial<Team>) =>
  updateFestival((s) => ({ ...s, teams: s.teams.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));

function removeTeam(id: string) {
  updateFestival((s) => ({
    ...s,
    teams: s.teams.filter((t) => t.id !== id),
    participants: s.participants.map((p) => (p.teamId === id ? { ...p, teamId: null } : p)),
    investments: Object.fromEntries(
      Object.entries(s.investments).map(([pid, byTeam]) => {
        const rest = { ...byTeam };
        delete rest[id];
        return [pid, rest];
      }),
    ),
  }));
}

/* ---------- Screen ---------- */

export function AdminScreen() {
  const state = useFestival();
  const [view, setView] = useState<View>("people");

  const present = state.participants.filter((p) => p.checkedIn).length;
  const investors = state.participants.filter((p) => Object.values(state.investments[p.id] ?? {}).some((v) => v > 0)).length;

  return (
    <ScreenFrame badge="운영진" tabs={VIEWS} active={view} onTab={setView} actions={<ResetButton />}>
      <dl className="mb-8 grid grid-cols-2 gap-px border border-fg/10 bg-fg/10 sm:grid-cols-4">
        {[
          ["참가자", `${state.participants.length}명`],
          ["팀", `${state.teams.length}팀`],
          ["출석", `${present} / ${state.participants.length}`],
          ["투자 확정", `${investors}명`],
        ].map(([k, v]) => (
          <div key={k} className="bg-page px-4 py-3">
            <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-fg/50">{k}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      {view === "people" && <PeoplePanel state={state} />}
      {view === "teams" && <TeamsPanel state={state} />}
      {view === "attendance" && <AttendancePanel state={state} />}
      {view === "invest" && <InvestStatusPanel state={state} />}
    </ScreenFrame>
  );
}

function ResetButton() {
  const [arm, setArm] = useState(false);
  return arm ? (
    <span className="hidden items-center gap-1 sm:flex">
      <button
        type="button"
        onClick={() => {
          resetFestival();
          setArm(false);
        }}
        className="h-10 border border-[var(--g-red)] px-3 text-sm font-semibold text-[var(--g-red)] transition hover:bg-[var(--g-red)]/10"
      >
        초기화 확인
      </button>
      <button type="button" onClick={() => setArm(false)} className={`h-10 ${smallBtn}`}>
        취소
      </button>
    </span>
  ) : (
    <button type="button" onClick={() => setArm(true)} className={`hidden h-10 sm:block ${smallBtn}`} title="목업 데이터를 처음 상태로 되돌립니다">
      목업 초기화
    </button>
  );
}

// Two-step delete so a stray click doesn't remove anything
function DeleteButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [arm, setArm] = useState(false);
  return arm ? (
    <span className="inline-flex gap-1">
      <button type="button" onClick={onConfirm} className="border border-[var(--g-red)] px-2.5 py-1.5 text-sm font-semibold text-[var(--g-red)]">
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
          <span className="font-mono text-xs text-fg/50">
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
          <table className="w-full min-w-[40rem] border-t border-fg/15 text-left text-sm">
            <thead className="text-xs text-fg/50">
              <tr className="border-b border-fg/15">
                <th className="py-2 pr-3 font-medium">이름</th>
                <th className="py-2 pr-3 font-medium">학교</th>
                <th className="py-2 pr-3 font-medium">팀</th>
                <th className="py-2 pr-3 font-medium">출석</th>
                <th className="py-2 font-medium">
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

  function save() {
    if (!name.trim()) return;
    setParticipant(p.id, { name: name.trim(), school: sch });
    setEditing(false);
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
          <span className="font-semibold">{p.name}</span>
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

function AddParticipant({ teams }: { teams: Team[] }) {
  const id = useId();
  const [name, setName] = useState("");
  const [sch, setSch] = useState<SchoolKey>("ku");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("이름을 입력해 주세요.");
    updateFestival((s) => ({
      ...s,
      participants: [...s.participants, { id: newId("p"), name: name.trim(), school: sch, teamId, checkedIn: false }],
    }));
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
        <button type="submit" className={`${primaryBtn} h-[2.4rem]`}>
          추가
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--g-red)]">
          {error}
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
                  <span className="font-semibold">{p.name}</span>
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

  function save(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setTeam(team.id, {
      name: form.name.trim(),
      table: form.table.trim(),
      project: form.project.trim(),
      desc: form.desc.trim(),
    });
    setEditing(false);
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
                <p className="font-mono text-xs text-fg/50">{team.table || "테이블 미정"}</p>
                <h3 className="mt-1 truncate text-xl font-semibold">{team.name}</h3>
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

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("팀명을 입력해 주세요.");
    updateFestival((s) => ({
      ...s,
      teams: [...s.teams, { id: newId("t"), name: name.trim(), table: table.trim(), project: project.trim(), desc: "" }],
    }));
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
          <input id={`${id}-table`} value={table} onChange={(e) => setTable(e.target.value)} placeholder="D-01" className={`${fieldCls} py-2`} />
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
        <CodeCard code={state.attendanceCode} />
        <section aria-labelledby="att-rate" className="border border-fg/15 p-5">
          <Label id="att-rate">출석률</Label>
          <p className="mt-2 font-mono text-4xl font-semibold tabular-nums">
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
                  <p className="min-w-0 truncate font-semibold">{g.title}</p>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-xs text-fg/50">
                      {here}/{g.people.length}
                    </span>
                    {here < g.people.length && (
                      <button
                        type="button"
                        onClick={() =>
                          updateFestival((s) => ({
                            ...s,
                            participants: s.participants.map((p) => (g.people.some((x) => x.id === p.id) ? { ...p, checkedIn: true } : p)),
                          }))
                        }
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
                          onClick={() => setParticipant(p.id, { checkedIn: !p.checkedIn })}
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

  function apply(next: string) {
    updateFestival((s) => ({ ...s, attendanceCode: next }));
    setValue("");
  }

  return (
    <section aria-labelledby={`${id}-title`} className="border border-fg/15 bg-fg/[0.04] p-5">
      <Label id={`${id}-title`}>출석 코드</Label>
      <p className="mt-2 font-mono text-5xl font-semibold tracking-[0.3em]">{code}</p>
      <p className="mt-1 text-xs text-fg/50">현장 화면에 띄워 주세요. 바꾸면 참가자 화면에 바로 적용됩니다.</p>
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
          className="w-28 border border-fg/20 bg-fg/[0.04] px-3 py-2 text-center font-mono tracking-[0.3em] text-fg outline-none placeholder:tracking-normal placeholder:text-fg/30 focus:border-fg/60"
        />
        <button type="submit" disabled={value.length < 4} className={primaryBtn}>
          변경
        </button>
        <button
          type="button"
          onClick={() => apply(String(Math.floor(Math.random() * 10000)).padStart(4, "0"))}
          className={smallBtn}
        >
          랜덤 생성
        </button>
      </form>
    </section>
  );
}

/* ---------- 투자 현황 / 발행 ---------- */

function InvestStatusPanel({ state }: { state: FestivalState }) {
  const live = liveTotals(state);
  const snap = latestTick(state);
  const rows = state.teams
    .map((t) => ({ team: t, total: live.totals[t.id] ?? 0, investors: live.investors[t.id] ?? 0 }))
    .sort((a, b) => b.total - a.total);
  const top = rows[0]?.total ?? 0;
  const grand = rows.reduce((s, r) => s + r.total, 0);
  const pool = state.participants.length * INVEST_BUDGET;
  const changed = !snap || state.teams.some((t) => (snap.totals[t.id] ?? 0) !== (live.totals[t.id] ?? 0));
  const nameOf = (pid: string) => state.participants.find((p) => p.id === pid)?.name;

  return (
    <div className="grid gap-8">
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="pool" className="border border-fg/15 p-5">
          <Label id="pool">전체 투자금</Label>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{won(grand)}</p>
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
            <span className="font-mono text-xs text-fg/50">틱 {state.ticks.length}개</span>
          </div>
          <p className="mt-2 text-lg font-semibold">{snap ? `최근 발행 ${timeLabel(snap.at)}` : "아직 발행하지 않았습니다"}</p>
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
              onClick={() => updateFestival((s) => ({ ...s, ticks: [...s.ticks, liveTotals(s)] }))}
              disabled={!changed}
              className={`${primaryBtn} px-5 py-2.5 text-base`}
            >
              새 틱 발행하기
            </button>
            {snap && (
              <DeleteButton
                label="최근 틱 삭제"
                onConfirm={() => updateFestival((s) => ({ ...s, ticks: s.ticks.slice(0, -1) }))}
              />
            )}
          </div>
          <p className="mt-2 text-xs text-fg/40">
            발행할 때마다 틱이 하나씩 쌓이고, 참가자는 발행된 틱들만 그래프로 볼 수 있습니다. 삭제는 가장 최근 틱만 지웁니다.
          </p>
        </section>
      </div>

      <section aria-labelledby="live-rank">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-4">
          <Label id="live-rank">실시간 투자 현황</Label>
          <span className="font-mono text-xs text-fg/50">운영진 전용 · 확정된 투자만 집계</span>
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
                    <span className="font-mono text-lg font-semibold text-fg/60">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{t.project || "프로젝트 미정"}</span>
                      <span className="block truncate text-xs text-fg/50">
                        {t.name} · 투자자 {investors}명
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-mono text-sm font-semibold tabular-nums">{won(total)}</span>
                      {snap && diff !== 0 && (
                        <span className="block font-mono text-xs text-fg/50">
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
                            <span className="font-mono tabular-nums text-fg/70">{won(b.amt)}</span>
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
