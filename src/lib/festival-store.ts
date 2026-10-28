// Mock backend shared by /onfestival (participant) and /organize (admin).
// State lives in localStorage so both pages — and other tabs — see the same data.
// Replace with a real API when one exists.

import { useSyncExternalStore } from "react";
import {
  INVEST_BUDGET,
  INVEST_STEP,
  myParticipantId,
  seedAttendanceCode,
  seedParticipants,
  seedTeams,
  type Participant,
  type Team,
} from "@/data/guide";

// Confirmed investments: participantId -> teamId -> amount
export type Investments = Record<string, Record<string, number>>;

// One published investment status ("tick"). Participants only ever see published ticks,
// never live totals.
export type Snapshot = {
  at: number;
  totals: Record<string, number>; // teamId -> amount
  investors: Record<string, number>; // teamId -> number of investors
};

export type FestivalState = {
  participants: Participant[];
  teams: Team[];
  investments: Investments;
  ticks: Snapshot[]; // every publish, oldest first
  attendanceCode: string;
};

const KEY = "devfest-festival-mock-v2";
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

export const seedState: FestivalState = {
  participants: seedParticipants,
  teams: seedTeams,
  investments: seedInv,
  ticks: seedTicks(seedInv),
  attendanceCode: seedAttendanceCode,
};

// useSyncExternalStore needs a stable reference until the data changes.
let cacheRaw: string | null | undefined;
let cache: FestivalState = seedState;

function read(): FestivalState {
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
    cache = raw ? { ...seedState, ...(JSON.parse(raw) as Partial<FestivalState>) } : seedState;
  } catch {
    cache = seedState;
  }
  return cache;
}

function write(next: FestivalState) {
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

export function useFestival(): FestivalState {
  return useSyncExternalStore(subscribe, read, () => seedState);
}

export function updateFestival(fn: (s: FestivalState) => FestivalState) {
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

export const clockLabel = (at: number) =>
  new Date(at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
