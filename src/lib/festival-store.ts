// Mock backend for the investment features shared by /onfestival (participant)
// and /organize (admin): confirmed investments, budgets and published ticks.
// Participants, teams and attendance live in Supabase (src/lib/db); this store
// keys its data by their Supabase ids. State lives in localStorage so both
// pages, and other tabs, see the same data.

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { INVEST_BUDGET, INVEST_STEP, myParticipantId, seedParticipants, seedTeams, type Participant, type Team } from "@/data/guide";

// Confirmed investments: participantId -> teamId -> amount
export type Investments = Record<string, Record<string, number>>;

// One published investment status ("tick"). Participants only ever see published ticks,
// never live totals.
export type Snapshot = {
  at: number;
  totals: Record<string, number>; // teamId -> amount
  investors: Record<string, number>; // teamId -> number of investors
};

// What this store persists
export type MockState = {
  investments: Investments;
  budgets: Record<string, number>; // participantId -> budget set by staff; missing = INVEST_BUDGET
  ticks: Snapshot[]; // every publish, oldest first
  // The seed below uses guide.ts ids (p01, t01); they are mapped to Supabase ids once loaded
  idsFrom: "mock" | "supabase";
};

// What screens read: the mock data plus participants and teams from Supabase
export type FestivalState = MockState & { participants: Participant[]; teams: Team[] };

const KEY = "devfest-festival-mock-v3";
const EVENT = "festivalchange";

// Deterministic sample investments so the admin view isn't empty.
function seedInvestments(): Investments {
  const out: Investments = {};
  const ids = seedTeams.map((t) => t.id);
  seedParticipants.forEach((p, i) => {
    if (p.id === myParticipantId || !p.teamId || i % 4 === 3) return;
    const others = ids.filter((id) => id !== p.teamId);
    const picks = [others[i % others.length], others[(i * 3 + 1) % others.length], others[(i * 5 + 2) % others.length]];
    const split = [0.5, 0.3, 0.2];
    const mine: Record<string, number> = {};
    picks.forEach((id, k) => {
      const amt = Math.round((INVEST_BUDGET * split[k]) / INVEST_STEP) * INVEST_STEP;
      mine[id] = (mine[id] ?? 0) + amt;
    });
    out[p.id] = mine;
  });
  return out;
}

// A few earlier ticks so the participant chart has history to show.
// Each team grows at its own pace, so the ranking moves between ticks.
function seedTicks(investments: Investments): Snapshot[] {
  const now = liveTotals({ participants: seedParticipants, investments });
  const start = new Date("2026-11-06T13:00:00+09:00").getTime();
  const pace = [0.2, 0.42, 0.63, 0.82];
  return pace.map((base, k) => {
    const totals: Record<string, number> = {};
    const investors: Record<string, number> = {};
    seedTeams.forEach((t, i) => {
      const jitter = ((i * 7 + k * 13) % 10) / 10; // 0..0.9, deterministic
      const f = Math.min(1, base * (0.6 + 0.8 * jitter));
      totals[t.id] = Math.round(((now.totals[t.id] ?? 0) * f) / 10_000) * 10_000;
      investors[t.id] = Math.round((now.investors[t.id] ?? 0) * f);
    });
    return { at: start + k * 40 * 60_000, totals, investors };
  });
}

const seedInv = seedInvestments();

export const seedState: MockState = {
  investments: seedInv,
  budgets: {},
  ticks: seedTicks(seedInv),
  idsFrom: "mock",
};

// Map the seed's guide.ts ids to Supabase ids: people by name, teams by table.
// Anything without a match is dropped.
function rekey(s: MockState, people: Participant[], teams: Team[]): MockState {
  const pid = new Map<string, string>();
  for (const p of seedParticipants) {
    const real = people.find((x) => x.name === p.name);
    if (real) pid.set(p.id, real.id);
  }
  const tid = new Map<string, string>();
  for (const t of seedTeams) {
    const real = teams.find((x) => x.table === t.table);
    if (real) tid.set(t.id, real.id);
  }
  const mapKeys = <V>(o: Record<string, V>, m: Map<string, string>) =>
    Object.fromEntries(Object.entries(o).flatMap(([k, v]) => (m.has(k) ? [[m.get(k)!, v]] : [])));
  return {
    investments: Object.fromEntries(
      Object.entries(s.investments).flatMap(([p, byTeam]) => (pid.has(p) ? [[pid.get(p)!, mapKeys(byTeam, tid)]] : [])),
    ),
    budgets: mapKeys(s.budgets, pid),
    ticks: s.ticks.map((t) => ({ ...t, totals: mapKeys(t.totals, tid), investors: mapKeys(t.investors, tid) })),
    idsFrom: "supabase",
  };
}

// useSyncExternalStore needs a stable reference until the data changes.
let cacheRaw: string | null | undefined;
let cache: MockState = seedState;

function read(): MockState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Storage blocked: fall back to in-memory state
    return cache;
  }
  if (raw === cacheRaw) return cache;
  cacheRaw = raw;
  try {
    cache = raw ? { ...seedState, ...(JSON.parse(raw) as Partial<MockState>) } : seedState;
  } catch {
    cache = seedState;
  }
  return cache;
}

function write(next: MockState) {
  cache = next;
  cacheRaw = JSON.stringify(next);
  try {
    localStorage.setItem(KEY, cacheRaw);
  } catch {
    // Storage blocked: keep the change for this page only
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, cb);
  };
}

export function useMock(): MockState {
  return useSyncExternalStore(subscribe, read, () => seedState);
}

// Mock data joined with Supabase participants and teams; null while either is
// still loading (or while the seed is being mapped to Supabase ids).
export function useFestival(people: Participant[] | undefined, teams: Team[] | undefined): FestivalState | null {
  const mock = useMock();
  const ready = !!people && !!teams;
  useEffect(() => {
    if (ready && mock.idsFrom !== "supabase") updateFestival((s) => (s.idsFrom === "supabase" ? s : rekey(s, people, teams)));
  }, [ready, mock.idsFrom, people, teams]);
  return useMemo(
    () => (people && teams && mock.idsFrom === "supabase" ? { ...mock, participants: people, teams } : null),
    [mock, people, teams],
  );
}

export function updateFestival(fn: (s: MockState) => MockState) {
  write(fn(read()));
}

export function resetFestival() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  cacheRaw = undefined;
  cache = seedState;
  window.dispatchEvent(new Event(EVENT));
}

/* ---------- Derived data ---------- */

export const membersOf = (s: FestivalState, teamId: string) => s.participants.filter((p) => p.teamId === teamId);

// A participant's total budget (staff can change it per person on /organize)
export const budgetOf = (s: FestivalState, pid: string) => s.budgets[pid] ?? INVEST_BUDGET;

// How much a participant has confirmed so far
export const investedBy = (s: FestivalState, pid: string) => Object.values(s.investments[pid] ?? {}).reduce((sum, v) => sum + v, 0);

// Live totals from confirmed investments. Admin only.
export function liveTotals(s: Pick<FestivalState, "participants" | "investments">): Snapshot {
  const totals: Record<string, number> = {};
  const investors: Record<string, number> = {};
  const known = new Set(s.participants.map((p) => p.id));
  for (const [pid, byTeam] of Object.entries(s.investments)) {
    if (!known.has(pid)) continue;
    for (const [tid, amt] of Object.entries(byTeam)) {
      if (amt <= 0) continue;
      totals[tid] = (totals[tid] ?? 0) + amt;
      investors[tid] = (investors[tid] ?? 0) + 1;
    }
  }
  return { at: Date.now(), totals, investors };
}

export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export const timeLabel = (at: number) =>
  new Date(at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export const latestTick = (s: FestivalState): Snapshot | null => s.ticks[s.ticks.length - 1] ?? null;

export const clockLabel = (at: number) => new Date(at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
