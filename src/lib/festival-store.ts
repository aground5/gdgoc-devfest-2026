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

// Judges (심사위원) invest but are never on a team. Only staff know who they are:
// the participant directory reports everyone as a participant.
export const isJudge = (p: Pick<Participant, "role">) => p.role === "judge";

// A participant (not a judge) still waiting for a team
export const needsTeam = (p: Pick<Participant, "role" | "teamId">) => !p.teamId && !isJudge(p);

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

/* ---------- Settlement ---------- */

// Final score per team: what the team received, minus every member's unspent
// budget (budget - confirmed investment). Based on live confirmed investments,
// so it's admin only. Judges (role 'judge', never on a team) invest too, but
// their unspent budget isn't charged to anyone; neither is that of a
// participant who has no team yet (listed apart as a warning).
export type SettlementRow = {
  team: Team;
  received: number;
  penalty: number; // sum of members' unspent budget
  final: number; // received - penalty, may go below 0
  members: { person: Participant; budget: number; spent: number; unspent: number }[];
};

export function settlement(s: FestivalState) {
  const live = liveTotals(s);
  const unspentOf = (p: Participant) => {
    const budget = budgetOf(s, p.id);
    const spent = investedBy(s, p.id);
    return { person: p, budget, spent, unspent: Math.max(0, budget - spent) };
  };
  const rows: SettlementRow[] = s.teams
    .map((team) => {
      const members = membersOf(s, team.id).map(unspentOf);
      const received = live.totals[team.id] ?? 0;
      const penalty = members.reduce((sum, m) => sum + m.unspent, 0);
      return { team, received, penalty, final: received - penalty, members };
    })
    .sort((a, b) => b.final - a.final || b.received - a.received);
  const teamless = s.participants.filter((p) => !p.teamId || !s.teams.some((t) => t.id === p.teamId));
  // Judges: their investments count, their unspent budget is never a penalty
  const judges = teamless.filter(isJudge).map(unspentOf);
  // Participants nobody put on a team yet: their unspent budget can't be charged anywhere
  const unassigned = teamless.filter((p) => !isJudge(p)).map(unspentOf);
  return { rows, judges, unassigned };
}
