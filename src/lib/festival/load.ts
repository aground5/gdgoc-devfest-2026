// Loads FestivalState for the signed-in user. RLS decides what comes back:
// participants get their own private row and investments, staff get everyone's.

import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FestivalState, Investments, Snapshot, StaffExtras } from "./types";

export async function loadFestival(): Promise<FestivalState> {
  const supabase = await createClient();
  const [teams, people, priv, inv, ticks, totals, settings] = await Promise.all([
    supabase.from("teams").select("id, name, table_no, project, description").order("table_no").order("name"),
    supabase.from("participants").select("id, name, school, team_id").order("created_at").order("name"),
    supabase.from("participant_private").select("participant_id, budget, checked_in_at, invest_confirmed_at"),
    supabase.from("investments").select("participant_id, team_id, amount"),
    supabase.from("ticks").select("id, published_at").order("id"),
    supabase.from("tick_totals").select("tick_id, team_id, total, investors"),
    supabase.rpc("get_settings").single(),
  ]);
  const failed = [teams, people, priv, inv, ticks, totals, settings].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  const privBy = new Map((priv.data ?? []).map((r) => [r.participant_id, r]));

  // Never-confirmed participants stay absent; a confirmed empty allocation is {}.
  const investments: Investments = {};
  for (const r of priv.data ?? []) if (r.invest_confirmed_at) investments[r.participant_id] = {};
  for (const r of inv.data ?? []) (investments[r.participant_id] ??= {})[r.team_id] = r.amount;

  const budgets: Record<string, number> = {};
  for (const r of priv.data ?? []) if (r.budget !== null) budgets[r.participant_id] = r.budget;

  const snaps: Snapshot[] = (ticks.data ?? []).map((t) => ({ at: Date.parse(t.published_at), totals: {}, investors: {} }));
  const index = new Map((ticks.data ?? []).map((t, i) => [t.id, i]));
  for (const r of totals.data ?? []) {
    const s = snaps[index.get(r.tick_id) ?? -1];
    if (!s) continue;
    s.totals[r.team_id] = Number(r.total);
    s.investors[r.team_id] = r.investors;
  }

  return {
    teams: (teams.data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      table: t.table_no,
      project: t.project,
      desc: t.description,
    })),
    participants: (people.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      school: p.school,
      teamId: p.team_id,
      checkedIn: !!privBy.get(p.id)?.checked_in_at,
    })),
    investments,
    budgets,
    ticks: snaps,
    defaultBudget: settings.data!.default_budget,
    investStep: settings.data!.invest_step,
  };
}

// Staff-only data. Callers must have checked the viewer is staff.
export async function loadStaffExtras(): Promise<StaffExtras> {
  const supabase = await createClient();
  const [code, priv] = await Promise.all([
    supabase.rpc("get_attendance_code"),
    supabase.from("participant_private").select("participant_id, login_id, user_id"),
  ]);
  if (code.error) throw new Error(code.error.message);
  return {
    attendanceCode: code.data ?? "",
    logins: Object.fromEntries(
      (priv.data ?? []).map((r) => [r.participant_id, { loginId: r.login_id, issued: r.user_id !== null }]),
    ),
  };
}
