"use server";

// Participant writes. Each runs as the signed-in user, so RLS and the RPC checks decide.

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/festival/result";

// Team details only; membership and table are staff-only.
export async function updateMyTeam(patch: { name: string; project: string; desc: string }): Promise<ActionResult> {
  const name = patch.name.trim();
  if (!name) return { ok: false, error: "팀명을 입력해 주세요." };
  const supabase = await createClient();
  const { data: teamId } = await supabase.rpc("my_team_id");
  if (!teamId) return { ok: false, error: "배정된 팀이 없습니다." };
  const { data, error } = await supabase
    .from("teams")
    .update({ name, project: patch.project.trim(), description: patch.desc.trim() })
    .eq("id", teamId)
    .select("id");
  if (error || !data?.length) return fail(error);
  refresh();
  return ok(undefined);
}

// Returns whether the code was right.
export async function checkIn(code: string): Promise<ActionResult<boolean>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_in", { p_code: code });
  if (error) return fail(error, "출석 처리에 실패했습니다.");
  if (data) refresh();
  return ok(data);
}

// Replaces the whole allocation ({teamId: amount}).
export async function confirmInvestments(alloc: Record<string, number>): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_investments", { p_alloc: alloc });
  if (error) return fail(error, "투자를 확정하지 못했습니다.");
  refresh();
  return ok(undefined);
}
