// Every Supabase request the app makes, called straight from the browser with
// the signed-in user's token. RLS and table privileges in supabase/migrations
// decide what each call may do: staff get full CRUD, participants read-only
// plus a few RPCs. Rows are mapped to the app's Participant / Team types here.

import type { PostgrestError } from "@supabase/supabase-js";
import type { Participant, SchoolKey, Team } from "@/data/guide";
import type { Investments, Snapshot } from "@/lib/festival-store";
import { createClient } from "@/utils/supabase/client";

// createBrowserClient returns one shared client per page
const sb = () => createClient();

export type Mode = "staff" | "participant";

// Attendance days are counted in Korean time, like the DB default
export const seoulToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

export class DbError extends Error {}

function fail(error: PostgrestError): never {
  const text =
    error.code === "42501"
      ? "권한이 없습니다. 다시 로그인해 주세요."
      : error.code === "23505"
        ? "이미 같은 값이 있습니다."
        : error.code === "23514" || error.code === "22023"
          ? "입력값을 확인해 주세요."
          : `저장하지 못했습니다. (${error.message})`;
  throw new DbError(text);
}

// Unwrap a response: throw a DbError on failure. `data` is only null on
// success for maybeSingle() and void RPCs, which use the T | null form.
function ok<T>({ data, error }: { data: T | null; error: PostgrestError | null }): T {
  if (error) fail(error);
  return data as T;
}

/* ---------- Reads ---------- */

type TeamRow = { id: string; name: string; table_label: string; project: string; description: string };
const toTeam = (r: TeamRow): Team => ({ id: r.id, name: r.name, table: r.table_label, project: r.project, desc: r.description });

export async function fetchTeams(): Promise<Team[]> {
  const rows = ok(await sb().from("teams").select("id, name, table_label, project, description").order("table_label").order("name"));
  return rows.map(toTeam);
}

// Staff read the table (with access codes); participants get the public
// directory. Attendance comes back only for rows the caller may see: everyone
// for staff, just themselves for a participant.
export async function fetchPeople(mode: Mode): Promise<Participant[]> {
  type Row = { id: string; name: string; school: string; team_id: string | null; access_code?: string; invest_budget?: number | null };
  const [rows, attendance] = await Promise.all([
    mode === "staff"
      ? sb()
          .from("participants")
          .select("id, name, school, team_id, access_code, invest_budget")
          .order("name")
          .then(ok<Row[]>)
      : sb()
          .rpc("participant_directory")
          .then(ok<Row[]>),
    sb()
      .from("attendance")
      .select("participant_id")
      .eq("day", seoulToday())
      .then(ok<{ participant_id: string }[]>),
  ]);
  const here = new Set(attendance.map((a) => a.participant_id));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    school: r.school as SchoolKey,
    teamId: r.team_id,
    checkedIn: here.has(r.id),
    accessCode: r.access_code,
    budget: r.invest_budget,
  }));
}

// Venue attendance code (staff only; null = check-in closed)
export async function fetchVenueCode(): Promise<string | null> {
  const row = ok<{ code: string | null } | null>(await sb().from("attendance_settings").select("code").maybeSingle());
  return row?.code ?? null;
}

/* ---------- Staff writes ---------- */

export type PersonPatch = Partial<Pick<Participant, "name" | "school" | "teamId">>;

const personRow = (p: PersonPatch) => ({
  ...(p.name !== undefined && { name: p.name }),
  ...(p.school !== undefined && { school: p.school }),
  ...(p.teamId !== undefined && { team_id: p.teamId }),
});

// Returns the new participant's generated access code
export async function addParticipant(p: { name: string; school: SchoolKey; teamId: string | null }): Promise<string> {
  const row = ok<{ access_code: string }>(
    await sb().from("participants").insert({ name: p.name, school: p.school, team_id: p.teamId }).select("access_code").single(),
  );
  return row.access_code;
}

export async function updateParticipant(id: string, patch: PersonPatch) {
  ok(await sb().from("participants").update(personRow(patch)).eq("id", id));
}

export async function deleteParticipant(id: string) {
  ok(await sb().from("participants").delete().eq("id", id));
}

export type TeamPatch = Partial<Omit<Team, "id">>;

const teamRow = (t: TeamPatch) => ({
  ...(t.name !== undefined && { name: t.name }),
  ...(t.table !== undefined && { table_label: t.table }),
  ...(t.project !== undefined && { project: t.project }),
  ...(t.desc !== undefined && { description: t.desc }),
});

export async function addTeam(t: Omit<Team, "id">) {
  ok(
    await sb()
      .from("teams")
      .insert({ name: t.name, ...teamRow(t) }),
  );
}

export async function updateTeam(id: string, patch: TeamPatch) {
  ok(await sb().from("teams").update(teamRow(patch)).eq("id", id));
}

// Members become unassigned (FK on delete set null)
export async function deleteTeam(id: string) {
  ok(await sb().from("teams").delete().eq("id", id));
}

// Staff check-in / undo for today
export async function setAttendance(ids: string[], present: boolean) {
  if (ids.length === 0) return;
  const day = seoulToday();
  if (present) {
    const { data } = await sb().auth.getClaims();
    const by = data?.claims.sub ?? null;
    ok(
      await sb()
        .from("attendance")
        .upsert(
          ids.map((id) => ({ participant_id: id, day, method: "staff", checked_by: by })),
          { onConflict: "participant_id,day", ignoreDuplicates: true },
        ),
    );
  } else {
    ok(await sb().from("attendance").delete().eq("day", day).in("participant_id", ids));
  }
}

export async function setVenueCode(code: string | null) {
  ok(await sb().from("attendance_settings").update({ code, updated_at: new Date().toISOString() }).eq("id", true));
}

/* ---------- Investments (staff) ---------- */

export type InvestSettings = { defaultBudget: number; step: number; open: boolean };

export async function fetchInvestSettings(): Promise<InvestSettings> {
  const r = ok<{ default_budget: number; step: number; open: boolean }>(
    await sb().from("invest_settings").select("default_budget, step, open").single(),
  );
  return { defaultBudget: r.default_budget, step: r.step, open: r.open };
}

export async function setInvestSettings(patch: Partial<Pick<InvestSettings, "defaultBudget" | "open">>) {
  ok(
    await sb()
      .from("invest_settings")
      .update({
        ...(patch.defaultBudget !== undefined && { default_budget: patch.defaultBudget }),
        ...(patch.open !== undefined && { open: patch.open }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", true),
  );
}

// Current allocations: participantId -> teamId -> amount (staff see everyone)
export async function fetchInvestments(): Promise<Investments> {
  const rows = ok(await sb().from("investments").select("participant_id, team_id, amount"));
  const out: Investments = {};
  for (const r of rows) (out[r.participant_id] ??= {})[r.team_id] = r.amount;
  return out;
}

// Published ticks, oldest first
export async function fetchTicks(): Promise<Snapshot[]> {
  const rows = ok(
    await sb().from("invest_ticks").select("id, published_at, invest_tick_totals(team_id, total, investors)").order("published_at"),
  );
  return rows.map((t) => ({
    id: t.id,
    at: new Date(t.published_at).getTime(),
    totals: Object.fromEntries(t.invest_tick_totals.map((x) => [x.team_id, x.total])),
    investors: Object.fromEntries(t.invest_tick_totals.map((x) => [x.team_id, x.investors])),
  }));
}

// null = back to the default budget
export async function setBudgets(ids: string[], amount: number | null) {
  if (ids.length === 0) return;
  ok(await sb().from("participants").update({ invest_budget: amount }).in("id", ids));
}

export async function publishTick() {
  ok(await sb().rpc("publish_tick"));
}

export async function deleteTick(id: number) {
  ok(await sb().from("invest_ticks").delete().eq("id", id));
}

/* ---------- Participant RPCs ---------- */

export async function updateMyTeam(t: Pick<Team, "name" | "project" | "desc">) {
  ok(await sb().rpc("update_my_team", { p_name: t.name, p_project: t.project, p_description: t.desc }));
}

// True if checked in (now or earlier today), false if the code was wrong or check-in is closed
export async function checkIn(code: string): Promise<boolean> {
  return ok(await sb().rpc("check_in", { p_code: code })) !== null;
}
