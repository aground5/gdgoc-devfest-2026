"use client";

// 일괄 수정 tab on /organize: download the current teams and participants as a
// template, edit it, upload it, check the preview, apply. See src/lib/bulk-import.ts.

import { useId, useMemo, useState } from "react";
import type { Participant, Team } from "@/data/guide";
import { downloadCsv, downloadXlsx, parseFiles, plan, type Parsed } from "@/lib/bulk-import";
import { run } from "@/lib/db/hooks";
import { bulkImport, type ImportCounts } from "@/lib/db/queries";
import { Label, primaryBtn, smallBtn } from "./festival-ui";

export function BulkImportPanel({ people, teams }: { people: Participant[]; teams: Team[] }) {
  const id = useId();
  const [files, setFiles] = useState<string[]>([]);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [readError, setReadError] = useState("");
  const [deleteMissing, setDeleteMissing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportCounts | null>(null);

  // Recomputed against live data, so the preview stays right if someone else edits meanwhile
  const p = useMemo(() => (parsed ? plan(parsed, people, teams, deleteMissing) : null), [parsed, people, teams, deleteMissing]);
  const deletes = p ? p.team.deleted.length + p.person.deleted.length : 0;
  const changes = p ? p.team.added.length + p.team.updated.length + p.person.added.length + p.person.updated.length + deletes : 0;

  async function onFiles(list: FileList | null) {
    setResult(null);
    setReadError("");
    setParsed(null);
    setConfirmDelete(false);
    if (!list || list.length === 0) return;
    const arr = [...list];
    setFiles(arr.map((f) => f.name));
    try {
      setParsed(await parseFiles(arr));
    } catch (e) {
      setReadError((e as Error).message || "파일을 읽지 못했습니다.");
    }
  }

  async function apply() {
    if (!p) return;
    setBusy(true);
    let counts: ImportCounts | null = null;
    const ok = await run(async () => {
      counts = await bulkImport(p.teams, p.people, deleteMissing);
    });
    setBusy(false);
    if (!ok) return;
    setResult(counts);
    setParsed(null);
    setFiles([]);
    setConfirmDelete(false);
  }

  return (
    <div className="grid gap-8">
      <section aria-labelledby={`${id}-tpl`} className="border border-fg/15 p-5">
        <Label id={`${id}-tpl`}>1. 양식 내려받기</Label>
        <p className="mt-2 text-sm text-fg/60">지금 등록된 팀과 참가자가 채워진 양식입니다. 이 파일을 고쳐서 다시 올리면 됩니다.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void downloadXlsx(people, teams)} className={primaryBtn}>
            엑셀 (.xlsx, 팀·참가자 시트)
          </button>
          <button type="button" onClick={() => downloadCsv("teams", people, teams)} className={smallBtn}>
            팀 CSV
          </button>
          <button type="button" onClick={() => downloadCsv("people", people, teams)} className={smallBtn}>
            참가자 CSV
          </button>
        </div>
        <ul className="mt-4 grid gap-1 text-xs text-fg/50">
          <li>· 팀은 테이블로 구분합니다. 같은 테이블이면 수정, 새 테이블이면 추가됩니다.</li>
          <li>
            · 참가자 코드는 적지 않습니다. 새 참가자는 코드가 자동으로 만들어지고, 이미 있는 참가자(이름 + 학교가 같은 사람)는 기존 코드를
            그대로 씁니다.
          </li>
          <li>· 학교는 고려대·연세대·성균관대·KAIST(또는 ku·yu·skku·kaist)로 적습니다. 팀 테이블을 비우면 미배정입니다.</li>
          <li>· 팀 또는 참가자 파일 하나만 올리면 다른 쪽은 그대로 둡니다.</li>
        </ul>
      </section>

      <section aria-labelledby={`${id}-up`} className="border border-fg/15 p-5">
        <Label id={`${id}-up`}>2. 파일 올리기</Label>
        <label
          htmlFor={`${id}-file`}
          className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-fg/30 px-4 py-8 text-center text-sm transition hover:bg-fg/[0.04]"
        >
          <span className="font-bold">.xlsx 파일 또는 .csv 파일(팀·참가자) 선택</span>
          <span className="text-xs text-fg/50">{files.length ? files.join(", ") : "여러 개를 함께 고를 수 있습니다"}</span>
        </label>
        <input
          id={`${id}-file`}
          type="file"
          accept=".xlsx,.csv"
          multiple
          className="sr-only"
          onChange={(e) => {
            void onFiles(e.target.files);
            e.target.value = ""; // allow re-selecting the same file
          }}
        />
        {readError && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {readError}
          </p>
        )}
        {result && (
          <p role="status" className="mt-3 text-sm font-bold text-fg">
            적용했습니다. 팀 추가 {result.teams.added} · 수정 {result.teams.updated} · 삭제 {result.teams.deleted} / 참가자 추가{" "}
            {result.people.added} · 수정 {result.people.updated} · 삭제 {result.people.deleted}
          </p>
        )}
      </section>

      {p && (
        <section aria-labelledby={`${id}-pv`} className="border border-fg/15 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label id={`${id}-pv`}>3. 미리보기</Label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={deleteMissing}
                onChange={(e) => {
                  setDeleteMissing(e.target.checked);
                  setConfirmDelete(false);
                }}
              />
              파일에 없는 팀·참가자 삭제
            </label>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-px border border-fg/10 bg-fg/10 sm:grid-cols-4">
            {[
              ["팀 추가", p.team.added.length],
              ["팀 수정", p.team.updated.length],
              ["참가자 추가", p.person.added.length],
              ["참가자 수정", p.person.updated.length],
            ].map(([k, v]) => (
              <div key={k} className="bg-page px-4 py-3">
                <dt className="text-xs text-fg/50">{k}</dt>
                <dd className="mt-1 text-lg font-bold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>

          {p.errors.length > 0 && (
            <div role="alert" className="mt-4 border border-danger/50 bg-danger/[0.06] p-4 text-sm">
              <p className="font-bold text-danger">고쳐야 적용할 수 있습니다 ({p.errors.length})</p>
              <ul className="mt-2 grid gap-1 text-fg/80">
                {p.errors.slice(0, 30).map((e, i) => (
                  <li key={i}>· {e}</li>
                ))}
                {p.errors.length > 30 && <li>· 외 {p.errors.length - 30}건</li>}
              </ul>
            </div>
          )}

          <ChangeList title="새 팀" items={p.team.added.map((t) => `${t.table} · ${t.name}`)} />
          <ChangeList title="수정되는 팀" items={p.team.updated.map((t) => `${t.table} · ${t.name}`)} />
          <ChangeList title="새 참가자" items={p.person.added.map((r) => `${r.name}${r.table ? ` (${r.table})` : " (미배정)"}`)} />
          <ChangeList title="수정되는 참가자" items={p.person.updated.map((r) => `${r.name}${r.table ? ` → ${r.table}` : " → 미배정"}`)} />
          {deleteMissing && (
            <>
              <ChangeList danger title="삭제되는 팀" items={p.team.deleted.map((t) => `${t.table} · ${t.name}`)} />
              <ChangeList danger title="삭제되는 참가자" items={p.person.deleted.map((x) => x.name)} />
            </>
          )}
          <p className="mt-3 text-xs text-fg/40">
            변경 없음: 팀 {p.team.same} · 참가자 {p.person.same}
            {deletes > 0 && " · 삭제되는 참가자의 출석과 투자 기록도 함께 지워집니다."}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {deletes > 0 && !confirmDelete ? (
              <button
                type="button"
                disabled={p.errors.length > 0}
                onClick={() => setConfirmDelete(true)}
                className="border border-danger px-4 py-2 text-sm font-bold text-danger disabled:opacity-30"
              >
                {deletes}건 삭제 포함하여 적용…
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void apply()}
                disabled={busy || p.errors.length > 0 || changes === 0}
                className={
                  deletes > 0 ? "bg-ku px-4 py-2 text-sm font-bold text-paper disabled:opacity-30" : primaryBtn
                }
              >
                {busy
                  ? "적용 중…"
                  : changes === 0
                    ? "바뀐 내용 없음"
                    : deletes > 0
                      ? `삭제 ${deletes}건 포함 확정 적용`
                      : `${changes}건 적용`}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setParsed(null);
                setFiles([]);
                setConfirmDelete(false);
              }}
              className={smallBtn}
            >
              취소
            </button>
          </div>
          <p className="mt-2 text-xs text-fg/40">전체가 한 번에 적용되고, 중간에 문제가 생기면 아무것도 바뀌지 않습니다.</p>
        </section>
      )}
    </div>
  );
}

function ChangeList({ title, items, danger }: { title: string; items: string[]; danger?: boolean }) {
  if (items.length === 0) return null;
  return (
    <details className="mt-3 border-t border-fg/10 pt-3" open={danger}>
      <summary className={`cursor-pointer text-sm font-bold ${danger ? "text-danger" : ""}`}>
        {title} {items.length}
      </summary>
      <ul className="mt-2 grid gap-1 text-sm text-fg/70 sm:grid-cols-2">
        {items.slice(0, 100).map((x, i) => (
          <li key={i}>{x}</li>
        ))}
        {items.length > 100 && <li>외 {items.length - 100}건</li>}
      </ul>
    </details>
  );
}
