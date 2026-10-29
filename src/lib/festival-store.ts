// Shared shape of the festival screens (/onfestival, /organize) and helpers
// derived from it. All data comes from Supabase via src/lib/db; buildState()
// joins the query results into one FestivalState for the panels to render.

import type { Participant, Team } from "@/data/guide";
import type { InvestSettings } from "@/lib/db/queries";

// Confirmed investments: participantId -> teamId -> amount
export type Investments = Record<string, Record<string, number>>;

// One published investment status ("tick"). Participants only ever see published ticks,
// never live totals.
export type Snapshot = {
  id?: number; // invest_ticks.id
  at: number;
  totals: Record<string, number>; // teamId -> amount
  investors: Record<string, number>; // teamId -> number of investors
};

export type FestivalState = {
  participants: Participant[];
  teams: Team[];
  investments: Investments; // staff: everyone's; a participant: only their own
  budgets: Record<string, number>; // participantId -> staff-set budget; missing = defaultBudget
  ticks: Snapshot[]; // published, oldest first
  defaultBudget: number;
  step: number;
  investOpen: boolean;
};

// null until every query has loaded. Budgets come from Participant.budget.
export function buildState(
  people: Participant[] | undefined,
  teams: Team[] | undefined,
  settings: InvestSettings | undefined,
  investments: Investments | undefined,
  ticks: Snapshot[] | undefined,
): FestivalState | null {
  if (!people || !teams || !settings || !investments || !ticks) return null;
  return {
    participants: people,
    teams,
    investments,
    budgets: Object.fromEntries(people.flatMap((p) => (p.budget != null ? [[p.id, p.budget]] : []))),
    ticks,
    defaultBudget: settings.defaultBudget,
    step: settings.step,
    investOpen: settings.open,
  };
}

/* ---------- Derived data ---------- */

export const membersOf = (s: FestivalState, teamId: string) => s.participants.filter((p) => p.teamId === teamId);

// A participant's total budget (staff can change it per person on /organize)
export const budgetOf = (s: FestivalState, pid: string) => s.budgets[pid] ?? s.defaultBudget;

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
