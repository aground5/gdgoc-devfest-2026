"use server";

// Staff writes. RLS and the staff-only RPCs reject anyone who isn't staff.

import { refresh } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CODE_ALPHABET, formatCode, participantEmail } from "@/lib/festival/login-code";
import { fail, ok, type ActionResult } from "@/lib/festival/result";
import type { SchoolKey, Team } from "@/lib/festival/types";

type Db = Awaited<ReturnType<typeof createClient>>;

// Runs a write, refreshes the page on success.
async function run<T = undefined>(
  write: (db: Db) => PromiseLike<{ data?: unknown; error: { message: string; hint?: string; code?: string } | null }>,
  pick?: (data: unknown) => T,
): Promise<ActionResult<T>> {
  const db = await createClient();
  const { data, error } = await write(db);
  if (error) return fail(error);
  refresh();
  return ok((pick ? pick(data) : undefined) as T);
}

/* ---------- Participants ---------- */

export async function addParticipant(p: { name: string; school: SchoolKey; teamId: string | null }): Promise<ActionResult> {
  if (!p.name.trim()) return { ok: false, error: "이름을 입력해 주세요." };
  return run((db) => db.rpc("add_participant", { p_name: p.name, p_school: p.school, p_team: p.teamId ?? undefined }));
}

export async function updateParticipant(id: string, p: { name: string; school: SchoolKey }): Promise<ActionResult> {
  if (!p.name.trim()) return { ok: false, error: "이름을 입력해 주세요." };
  return run((db) => db.from("participants").update({ name: p.name.trim(), school: p.school }).eq("id", id));
}

// Also deletes their login account, so an issued code stops working.
export async function removeParticipant(id: string): Promise<ActionResult> {
  const db = await createClient();
  const { data: priv } = await db.from("participant_private").select("user_id").eq("participant_id", id).maybeSingle();
  const { data, error } = await db.from("participants").delete().eq("id", id).select("id");
  if (error || !data?.length) return fail(error);
  if (priv?.user_id) await createAdminClient().auth.admin.deleteUser(priv.user_id);
  refresh();
  return ok(undefined);
}

/* ---------- Login codes ---------- */

function randomSecret(length = 8) {
  const out: string[] = [];
  while (out.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length * 2))) {
      // 248 = 8 * 31: reject the tail so every character is equally likely
      if (b < 248 && out.length < length) out.push(CODE_ALPHABET[b % CODE_ALPHABET.length]);
    }
  }
  return out.join("");
}

// Issues a fresh code to each participant. Reissuing replaces the login account, which
// invalidates the old code and signs out every device that used it.
// The codes are returned once and never stored in readable form.
export async function issueCodes(ids: string[]): Promise<ActionResult<{ participantId: string; code: string }[]>> {
  const db = await createClient();
  const { data: staff } = await db.rpc("is_staff");
  if (!staff) return { ok: false, error: "운영진만 할 수 있습니다." };
  const { data: rows, error } = await db
    .from("participant_private")
    .select("participant_id, login_id, user_id")
    .in("participant_id", ids);
  if (error) return fail(error);

  const admin = createAdminClient();
  const issued: { participantId: string; code: string }[] = [];
  let failedCount = 0;
  for (const r of rows ?? []) {
    if (r.user_id) {
      const del = await admin.auth.admin.deleteUser(r.user_id);
      if (del.error) {
        failedCount++;
        continue;
      }
    }
    const secret = randomSecret();
    const created = await admin.auth.admin.createUser({
      email: participantEmail(r.login_id),
      password: secret,
      email_confirm: true,
    });
    if (created.error) failedCount++;
    else issued.push({ participantId: r.participant_id, code: formatCode(r.login_id, secret) });
  }
  refresh();
  if (issued.length === 0 && failedCount > 0) return { ok: false, error: "코드를 발급하지 못했습니다." };
  return ok(issued);
}

// The database drops any investment the person had in their new team.
export const assignTeam = async (id: string, teamId: string | null) =>
  run((db) => db.from("participants").update({ team_id: teamId }).eq("id", id));

/* ---------- Budgets ---------- */

export const setBudgets = async (ids: string[], amount: number) =>
  run((db) => db.rpc("set_budgets", { p_ids: ids, p_amount: amount }));

/* ---------- Teams ---------- */

export async function addTeam(t: { name: string; table: string; project: string }): Promise<ActionResult> {
  if (!t.name.trim()) return { ok: false, error: "팀명을 입력해 주세요." };
  return run((db) =>
    db.from("teams").insert({ name: t.name.trim(), table_no: t.table.trim(), project: t.project.trim() }),
  );
}

export async function updateTeam(id: string, t: Omit<Team, "id">): Promise<ActionResult> {
  if (!t.name.trim()) return { ok: false, error: "팀명을 입력해 주세요." };
  return run((db) =>
    db
      .from("teams")
      .update({ name: t.name.trim(), table_no: t.table.trim(), project: t.project.trim(), description: t.desc.trim() })
      .eq("id", id),
  );
}

// Members become unassigned and investments in the team are removed (FK rules).
export const removeTeam = async (id: string) => run((db) => db.from("teams").delete().eq("id", id));

/* ---------- Attendance ---------- */

export const setCheckedIn = async (ids: string[], on: boolean) =>
  run((db) => db.rpc("set_checked_in", { p_ids: ids, p_on: on }));

export const setAttendanceCode = async (code: string) =>
  run((db) => db.rpc("set_attendance_code", { p_code: code }));

export const randomAttendanceCode = async () => run((db) => db.rpc("random_attendance_code"));

/* ---------- Published ticks ---------- */

export const publishTick = async () => run((db) => db.rpc("publish_tick"));

export const deleteLatestTick = async () => run((db) => db.rpc("delete_latest_tick"));
