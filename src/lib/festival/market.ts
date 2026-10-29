// Loads Demo Market entries the signed-in user may see (RLS: published + not hidden,
// plus their own team's entry; staff see everything), with signed URLs for uploads.

import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MarketAsset, MarketEntry } from "./types";

export async function loadMarket(): Promise<MarketEntry[]> {
  const supabase = await createClient();
  const [entries, creds, assets] = await Promise.all([
    supabase.from("demo_entries").select("*").order("published_at", { ascending: false, nullsFirst: false }),
    supabase.from("demo_entry_credentials").select("entry_id, credentials"),
    supabase.from("demo_assets").select("*").order("sort").order("created_at"),
  ]);
  const failed = [entries, creds, assets].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  // One signed-URL request per bucket
  const urls = new Map<string, string>();
  for (const bucket of ["demo-images", "demo-files"] as const) {
    const paths = (assets.data ?? []).filter((a) => a.bucket === bucket).map((a) => a.path);
    if (paths.length === 0) continue;
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrls(paths, 60 * 60, bucket === "demo-files" ? { download: true } : undefined);
    for (const s of data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  const credBy = new Map((creds.data ?? []).map((c) => [c.entry_id, c.credentials]));
  const assetsBy = new Map<string, MarketAsset[]>();
  for (const a of assets.data ?? []) {
    const list = assetsBy.get(a.entry_id) ?? [];
    list.push({
      id: a.id,
      kind: a.kind as MarketAsset["kind"], // CHECK-constrained in the database
      bucket: a.bucket as MarketAsset["bucket"],
      path: a.path,
      fileName: a.file_name,
      mime: a.mime,
      size: a.size_bytes,
      caption: a.caption,
      url: urls.get(a.path) ?? null,
    });
    assetsBy.set(a.entry_id, list);
  }

  return (entries.data ?? []).map((e) => {
    const all = assetsBy.get(e.id) ?? [];
    return {
      id: e.id,
      teamId: e.team_id,
      status: e.status,
      title: e.title,
      description: e.description,
      testInstructions: e.test_instructions,
      liveUrl: e.live_url,
      repoUrl: e.repo_url,
      videoUrl: e.video_url,
      hidden: e.hidden,
      hiddenReason: e.hidden_reason,
      publishedAt: e.published_at ? Date.parse(e.published_at) : null,
      updatedAt: Date.parse(e.updated_at),
      credentials: credBy.get(e.id) ?? null,
      images: all.filter((a) => a.kind === "image"),
      files: all.filter((a) => a.kind === "file"),
    };
  });
}
