"use server";

// Demo Market writes. Members edit only their own team's entry (RLS + triggers);
// staff can hide or remove any entry.

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ASSET_RULES, normalizeUrl, type AssetKind } from "@/lib/festival/market-rules";
import { fail, ok, type ActionResult } from "@/lib/festival/result";

export type EntryInput = {
  title: string;
  liveUrl: string;
  repoUrl: string;
  videoUrl: string;
  description: string;
  testInstructions: string;
  credentials: string;
};

// Creates or updates the caller's team entry. `publish` = true publishes, false keeps/makes it a draft.
export async function saveEntry(input: EntryInput, publish: boolean): Promise<ActionResult<string>> {
  const liveUrl = normalizeUrl(input.liveUrl);
  const repoUrl = normalizeUrl(input.repoUrl);
  const videoUrl = normalizeUrl(input.videoUrl);
  if (liveUrl === false || repoUrl === false || videoUrl === false) {
    return { ok: false, error: "링크는 http:// 또는 https:// 로 시작하는 주소여야 합니다." };
  }
  if (publish && (!liveUrl || !input.description.trim() || !input.testInstructions.trim())) {
    return { ok: false, error: "공개하려면 서비스 링크, 소개, 테스트 방법을 모두 입력해 주세요." };
  }

  const db = await createClient();
  const { data: teamId } = await db.rpc("my_team_id");
  if (!teamId) return { ok: false, error: "배정된 팀이 없습니다." };

  const row = {
    team_id: teamId,
    status: publish ? ("published" as const) : ("draft" as const),
    title: input.title.trim(),
    live_url: liveUrl,
    repo_url: repoUrl,
    video_url: videoUrl,
    description: input.description.trim(),
    test_instructions: input.testInstructions.trim(),
  };
  const { data: entry, error } = await db.from("demo_entries").upsert(row, { onConflict: "team_id" }).select("id").single();
  if (error || !entry) return fail(error);

  const creds = input.credentials.trim();
  const c = creds
    ? await db
        .from("demo_entry_credentials")
        .upsert({ entry_id: entry.id, team_id: teamId, credentials: creds }, { onConflict: "entry_id" })
    : await db.from("demo_entry_credentials").delete().eq("entry_id", entry.id);
  if (c.error) return fail(c.error);

  refresh();
  return ok(entry.id);
}

export async function unpublishEntry(entryId: string): Promise<ActionResult> {
  const db = await createClient();
  const { data, error } = await db.from("demo_entries").update({ status: "draft" }).eq("id", entryId).select("id");
  if (error || !data?.length) return fail(error);
  refresh();
  return ok(undefined);
}

// Called after the browser uploaded the object to Storage. Removes the object if the row is rejected.
export async function registerAsset(a: {
  entryId: string;
  kind: AssetKind;
  path: string;
  fileName: string;
  mime: string;
  size: number;
}): Promise<ActionResult> {
  const rule = ASSET_RULES[a.kind];
  const db = await createClient();
  const { data: teamId } = await db.rpc("my_team_id");
  const { error } = await db.from("demo_assets").insert({
    entry_id: a.entryId,
    team_id: teamId ?? "",
    kind: a.kind,
    bucket: rule.bucket,
    path: a.path,
    file_name: a.fileName.slice(0, 200),
    mime: a.mime,
    size_bytes: a.size,
  });
  if (error) {
    await db.storage.from(rule.bucket).remove([a.path]);
    return fail(error, "파일을 등록하지 못했습니다.");
  }
  refresh();
  return ok(undefined);
}

// Storage first (SQL can't delete objects), then the row.
export async function deleteAsset(assetId: string): Promise<ActionResult> {
  const db = await createClient();
  const { data: asset } = await db.from("demo_assets").select("bucket, path").eq("id", assetId).single();
  if (!asset) return { ok: false, error: "파일을 찾을 수 없습니다." };
  const removed = await db.storage.from(asset.bucket).remove([asset.path]);
  if (removed.error) return fail(null, "파일을 삭제하지 못했습니다.");
  const { error } = await db.from("demo_assets").delete().eq("id", assetId);
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

// Members or staff. Removes every uploaded object under the entry first.
export async function deleteEntry(entryId: string): Promise<ActionResult> {
  const db = await createClient();
  const { data: assets } = await db.from("demo_assets").select("bucket, path").eq("entry_id", entryId);
  for (const bucket of ["demo-images", "demo-files"] as const) {
    const paths = (assets ?? []).filter((a) => a.bucket === bucket).map((a) => a.path);
    if (paths.length) await db.storage.from(bucket).remove(paths);
  }
  const { data, error } = await db.from("demo_entries").delete().eq("id", entryId).select("id");
  if (error || !data?.length) return fail(error, "삭제하지 못했습니다.");
  refresh();
  return ok(undefined);
}

// Staff moderation.
export async function setEntryHidden(entryId: string, hidden: boolean, reason: string): Promise<ActionResult> {
  const db = await createClient();
  const { data, error } = await db
    .from("demo_entries")
    .update({ hidden, hidden_reason: hidden ? reason.trim() || null : null })
    .eq("id", entryId)
    .select("id");
  if (error || !data?.length) return fail(error);
  refresh();
  return ok(undefined);
}
