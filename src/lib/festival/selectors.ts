// Pure helpers over FestivalState, shared by the participant and staff screens.

import type { FestivalState, Snapshot } from "./types";

export const membersOf = (s: FestivalState, teamId: string) => s.participants.filter((p) => p.teamId === teamId);

// Total budget for a participant: staff override or the default.
export const budgetOf = (s: FestivalState, pid: string) => s.budgets[pid] ?? s.defaultBudget;

// Sum of a participant's confirmed investments
export const investedBy = (s: FestivalState, pid: string) =>
  Object.values(s.investments[pid] ?? {}).reduce((sum, v) => sum + v, 0);

// Live totals from confirmed investments. Only meaningful for staff, who load everyone's investments.
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
