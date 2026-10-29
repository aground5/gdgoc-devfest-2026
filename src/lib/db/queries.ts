// Every Supabase request the app makes, called straight from the browser with
// the signed-in user's token. RLS and table privileges in supabase/migrations
// decide what each call may do: staff get full CRUD, participants read-only
// plus a few RPCs. Rows are mapped to the app's Participant / Team types here.

import type { PostgrestError } from "@supabase/supabase-js";
import type { Participant, SchoolKey, Team } from "@/data/guide";
import type { Investments, Snapshot } from "@/lib/festival-store";
import { createClient } from "@/utils/supabase/client";
import { ASSET_RULES, normalizeUrl, type AssetKind } from "@/lib/market-rules";

// createBrowserClient returns one shared client per page
const sb = () => createClient();

export type Mode = "staff" | "participant";

// Attendance days are counted in Korean time, like the DB default
export const seoulToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

export class DbError extends Error {}

// Business-rule errors raised by confirm_investments(), publish_tick() and check_in() carry a hint
const HINTS: Record<string, string> = {
  closed: "투자가 마감되었습니다.",
  over_budget: "투자금을 초과했습니다. 금액을 줄여 주세요.",
  own_team: "내 팀 프로젝트에는 투자할 수 없습니다.",
  step: "투자 단위에 맞지 않는 금액이 있습니다.",
  unchanged: "마지막 발행 이후 바뀐 투자가 없습니다.",
  rate_limited: "출석 코드를 여러 번 잘못 입력했습니다. 10분 뒤에 다시 시도해 주세요.",
  dup_table: "파일에 같은 팀 테이블이 두 번 이상 있습니다.",
  dup_person: "파일에 이름과 학교가 같은 참가자가 두 번 이상 있습니다.",
  ambiguous_person:
    "이름과 학교가 같은 참가자가 이미 여러 명 있어 누구인지 알 수 없습니다. 그 사람은 파일에서 빼고 참가자 탭에서 수정해 주세요.",
  team_required: "팀의 테이블과 팀명은 비워 둘 수 없습니다.",
  person_required: "참가자 이름은 비워 둘 수 없습니다.",
  bad_school: "알 수 없는 학교가 있습니다.",
  bad_table: "팀 목록에 없는 팀 테이블을 쓴 참가자가 있습니다.",
  too_many_assets: "올릴 수 있는 개수를 넘었습니다.",
};

function fail(error: PostgrestError): never {
  const hinted = error.hint ? HINTS[error.hint] : undefined;
  if (hinted) throw new DbError(hinted);
  const text =
    error.code === "42501"
      ? "권한이 없습니다. 다시 로그인해 주세요."
      : error.code === "23505"
        ? "이미 등록되어 있습니다."
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

export async function setInvestSettings(patch: Partial<InvestSettings>) {
  ok(
    await sb()
      .from("invest_settings")
      .update({
        ...(patch.defaultBudget !== undefined && { default_budget: patch.defaultBudget }),
        ...(patch.open !== undefined && { open: patch.open }),
        ...(patch.step !== undefined && { step: patch.step }),
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

/* ---------- Staff whitelist ---------- */

export type StaffEmail = { email: string; note: string; addedBy: string | null; createdAt: number };

export async function fetchStaffEmails(): Promise<StaffEmail[]> {
  const rows = ok(await sb().from("staff_emails").select("email, note, added_by, created_at").order("created_at"));
  return rows.map((r) => ({ email: r.email, note: r.note, addedBy: r.added_by, createdAt: new Date(r.created_at).getTime() }));
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

export async function addStaffEmail(email: string, note: string) {
  ok(
    await sb()
      .from("staff_emails")
      .insert({ email: normalizeEmail(email), note: note.trim() }),
  );
}

export async function updateStaffNote(email: string, note: string) {
  ok(await sb().from("staff_emails").update({ note: note.trim() }).eq("email", email));
}

// RLS refuses removing your own email; that shows up as zero deleted rows
export async function removeStaffEmail(email: string) {
  const rows = ok(await sb().from("staff_emails").delete().eq("email", email).select("email"));
  if (rows.length === 0) throw new DbError("본인 이메일은 삭제할 수 없습니다.");
}

/* ---------- Bulk import ---------- */

export type ImportCounts = Record<"teams" | "people", { added: number; updated: number; deleted: number }>;

// Applies a whole file in one transaction (see the bulk_import migration)
export async function bulkImport(
  teams: { table: string; name: string; project: string; desc: string }[],
  people: { name: string; school: string; table: string }[],
  deleteMissing: boolean,
): Promise<ImportCounts> {
  return ok(
    await sb().rpc("bulk_import", { p_teams: teams, p_people: people, p_delete_missing: deleteMissing }),
  ) as unknown as ImportCounts;
}

/* ---------- Participant RPCs ---------- */

// The participant's own budget override (the directory doesn't include it)
export async function fetchMyBudget(id: string): Promise<number | null> {
  const row = ok<{ invest_budget: number | null } | null>(
    await sb().from("participants").select("invest_budget").eq("id", id).maybeSingle(),
  );
  return row?.invest_budget ?? null;
}

// Replaces the caller's whole allocation; zero amounts are dropped server-side
export async function confirmInvestments(alloc: Record<string, number>) {
  ok(await sb().rpc("confirm_investments", { p_alloc: alloc }));
}

export async function updateMyTeam(t: Pick<Team, "name" | "project" | "desc">) {
  ok(await sb().rpc("update_my_team", { p_name: t.name, p_project: t.project, p_description: t.desc }));
}

// True if checked in (now or earlier today), false if the code was wrong or check-in is closed
export async function checkIn(code: string): Promise<boolean> {
  return ok(await sb().rpc("check_in", { p_code: code })) !== null;
}

/* ---------- Demo Market ---------- */

export type DemoAsset = {
  id: string;
  kind: AssetKind;
  bucket: "demo-images" | "demo-files";
  path: string;
  fileName: string;
  size: number;
  url: string | null; // short-lived signed URL
};

export type DemoEntry = {
  id: string;
  teamId: string;
  status: "draft" | "published";
  title: string;
  description: string;
  testInstructions: string;
  liveUrl: string | null;
  repoUrl: string | null;
  videoUrl: string | null;
  hidden: boolean;
  hiddenReason: string | null;
  publishedAt: number | null;
  updatedAt: number;
  credentials: string | null; // test account info, if the team added any
  images: DemoAsset[];
  files: DemoAsset[];
};

// RLS returns what the caller may see: published, non-hidden entries plus
// their own team's (participants), or everything (staff). Uploads get signed URLs.
export async function fetchDemos(): Promise<DemoEntry[]> {
  const [entries, creds, assets] = await Promise.all([
    sb().from("demo_entries").select("*").order("published_at", { ascending: false, nullsFirst: false }).then(ok),
    sb().from("demo_entry_credentials").select("entry_id, credentials").then(ok),
    sb().from("demo_assets").select("*").order("sort").order("created_at").then(ok),
  ]);

  const urls = new Map<string, string>();
  for (const bucket of ["demo-images", "demo-files"] as const) {
    const paths = assets.filter((a) => a.bucket === bucket).map((a) => a.path);
    if (paths.length === 0) continue;
    const { data } = await sb()
      .storage.from(bucket)
      .createSignedUrls(paths, 60 * 60, bucket === "demo-files" ? { download: true } : undefined);
    for (const u of data ?? []) if (u.path && u.signedUrl) urls.set(u.path, u.signedUrl);
  }

  const credBy = new Map(creds.map((c) => [c.entry_id, c.credentials]));
  const assetsBy = new Map<string, DemoAsset[]>();
  for (const a of assets) {
    const list = assetsBy.get(a.entry_id) ?? [];
    list.push({
      id: a.id,
      kind: a.kind as AssetKind, // CHECK-constrained in the database
      bucket: a.bucket as DemoAsset["bucket"],
      path: a.path,
      fileName: a.file_name,
      size: a.size_bytes,
      url: urls.get(a.path) ?? null,
    });
    assetsBy.set(a.entry_id, list);
  }

  return entries.map((e) => {
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

export type DemoInput = {
  title: string;
  liveUrl: string;
  repoUrl: string;
  videoUrl: string;
  description: string;
  testInstructions: string;
  credentials: string;
};

// Creates or updates the caller's team entry; `publish` false keeps or makes it a draft.
// Returns the entry id.
export async function saveDemo(teamId: string, input: DemoInput, publish: boolean): Promise<string> {
  const liveUrl = normalizeUrl(input.liveUrl);
  const repoUrl = normalizeUrl(input.repoUrl);
  const videoUrl = normalizeUrl(input.videoUrl);
  if (liveUrl === false || repoUrl === false || videoUrl === false) {
    throw new DbError("링크는 http:// 또는 https:// 로 시작하는 주소여야 합니다.");
  }
  if (publish && (!liveUrl || !input.description.trim() || !input.testInstructions.trim())) {
    throw new DbError("공개하려면 서비스 링크, 소개, 테스트 방법을 모두 입력해 주세요.");
  }
  const entry = ok<{ id: string }>(
    await sb()
      .from("demo_entries")
      .upsert(
        {
          team_id: teamId,
          status: publish ? "published" : "draft",
          title: input.title.trim(),
          live_url: liveUrl,
          repo_url: repoUrl,
          video_url: videoUrl,
          description: input.description.trim(),
          test_instructions: input.testInstructions.trim(),
        },
        { onConflict: "team_id" },
      )
      .select("id")
      .single(),
  );
  const creds = input.credentials.trim();
  if (creds) {
    ok(
      await sb()
        .from("demo_entry_credentials")
        .upsert({ entry_id: entry.id, team_id: teamId, credentials: creds }, { onConflict: "entry_id" }),
    );
  } else {
    ok(await sb().from("demo_entry_credentials").delete().eq("entry_id", entry.id));
  }
  return entry.id;
}

export async function unpublishDemo(entryId: string) {
  ok(await sb().from("demo_entries").update({ status: "draft" }).eq("id", entryId));
}

// Browser -> Storage, then the row. If the row is rejected (limit, wrong team), the object is removed.
export async function uploadDemoAsset(teamId: string, entryId: string, kind: AssetKind, file: File, path: string, type: string) {
  const bucket = ASSET_RULES[kind].bucket;
  const up = await sb().storage.from(bucket).upload(path, file, { contentType: type, upsert: false });
  if (up.error) throw new DbError(`${file.name}: 업로드하지 못했습니다.`);
  const { error } = await sb().from("demo_assets").insert({
    entry_id: entryId,
    team_id: teamId,
    kind,
    bucket,
    path,
    file_name: file.name.slice(0, 200),
    mime: type,
    size_bytes: file.size,
  });
  if (error) {
    await sb().storage.from(bucket).remove([path]);
    fail(error);
  }
}

// Storage first (SQL can't delete objects), then the row
export async function deleteDemoAsset(a: Pick<DemoAsset, "id" | "bucket" | "path">) {
  const removed = await sb().storage.from(a.bucket).remove([a.path]);
  if (removed.error) throw new DbError("파일을 삭제하지 못했습니다.");
  ok(await sb().from("demo_assets").delete().eq("id", a.id));
}

// Team members or staff. Removes every uploaded object first.
export async function deleteDemo(entry: Pick<DemoEntry, "id" | "images" | "files">) {
  for (const list of [entry.images, entry.files]) {
    if (list.length) await sb().storage.from(list[0].bucket).remove(list.map((a) => a.path));
  }
  ok(await sb().from("demo_entries").delete().eq("id", entry.id));
}

// Staff moderation
export async function setDemoHidden(entryId: string, hidden: boolean, reason: string) {
  ok(
    await sb()
      .from("demo_entries")
      .update({ hidden, hidden_reason: hidden ? reason.trim() || null : null })
      .eq("id", entryId),
  );
}

