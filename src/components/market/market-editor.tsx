"use client";

// The team's own Demo Market entry: details, publish/unpublish, and uploads.
// Only shown to members of the team; the database rejects anyone else anyway.

import { useId, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import {
  deleteAsset,
  deleteEntry,
  registerAsset,
  saveEntry,
  unpublishEntry,
  type EntryInput,
} from "@/app/onfestival/market/actions";
import { ASSET_RULES, contentTypeOf, formatBytes, storagePath, type AssetKind } from "@/lib/festival/market-rules";
import type { MarketAsset, MarketEntry, Team } from "@/lib/festival/types";
import { createClient } from "@/lib/supabase/client";
import { Label, fieldCls, primaryBtn, smallBtn } from "../festival-ui";
import { StatusChip } from "./market-view";

const toInput = (e?: MarketEntry): EntryInput => ({
  title: e?.title ?? "",
  liveUrl: e?.liveUrl ?? "",
  repoUrl: e?.repoUrl ?? "",
  videoUrl: e?.videoUrl ?? "",
  description: e?.description ?? "",
  testInstructions: e?.testInstructions ?? "",
  credentials: e?.credentials ?? "",
});

export function MarketEditor({ team, entry }: { team: Team; entry?: MarketEntry }) {
  const id = useId();
  const [form, setForm] = useState<EntryInput>(() => toInput(entry));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, startSaving] = useTransition();
  const [armDelete, setArmDelete] = useState(false);

  const published = entry?.status === "published";
  const missing = [
    !form.liveUrl.trim() && "서비스 링크",
    !form.description.trim() && "소개",
    !form.testInstructions.trim() && "테스트 방법",
  ].filter(Boolean) as string[];

  const set = (key: keyof EntryInput) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [key]: e.target.value });
    setError("");
    setNotice("");
  };

  function save(publish: boolean) {
    startSaving(async () => {
      const res = await saveEntry(form, publish);
      if (!res.ok) return setError(res.error);
      setNotice(publish ? "공개되었습니다. 다른 팀이 데모 마켓에서 볼 수 있습니다." : "저장했습니다. 아직 우리 팀만 볼 수 있습니다.");
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    save(published);
  }

  const field = (key: keyof EntryInput, label: string, hint?: string, required = false) => (
    <label htmlFor={`${id}-${key}`} className="text-xs text-fg/60">
      {label}
      {required && <span className="text-[var(--g-red)]"> *</span>}
      <input id={`${id}-${key}`} value={form[key]} onChange={set(key)} className={fieldCls} placeholder={hint} />
    </label>
  );

  const area = (key: keyof EntryInput, label: string, hint: string, required = false, rows = 4) => (
    <label htmlFor={`${id}-${key}`} className="text-xs text-fg/60">
      {label}
      {required && <span className="text-[var(--g-red)]"> *</span>}
      <textarea id={`${id}-${key}`} value={form[key]} onChange={set(key)} rows={rows} placeholder={hint} className={fieldCls} />
    </label>
  );

  return (
    <section aria-labelledby={`${id}-title`} className="border border-fg/15 bg-fg/[0.04]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-fg/10 px-5 py-4 sm:px-7">
        <div className="flex items-center gap-2">
          <Label id={`${id}-title`}>우리 팀 데모</Label>
          {entry && <StatusChip entry={entry} />}
        </div>
        <span className="text-xs text-fg/50">{team.name} 팀원만 수정할 수 있습니다</span>
      </div>

      {entry?.hidden && (
        <p role="alert" className="mx-5 mt-5 border border-[var(--g-red)] px-4 py-3 text-sm sm:mx-7">
          운영진이 이 데모를 숨겼습니다{entry.hiddenReason ? `: ${entry.hiddenReason}` : "."} 수정 후 운영진에게 알려 주세요.
        </p>
      )}

      <form onSubmit={submit} noValidate className="grid gap-4 p-5 sm:p-7">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("title", "데모 이름", team.project || "비워 두면 프로젝트명이 표시됩니다")}
          {field("liveUrl", "서비스 링크", "https://", true)}
          {field("repoUrl", "코드 저장소 (선택)", "https://github.com/...")}
          {field("videoUrl", "데모 영상 (선택)", "https://youtu.be/...")}
        </div>
        {area("description", "소개", "어떤 문제를 어떻게 푸는 서비스인지 적어 주세요.", true)}
        {area("testInstructions", "테스트 방법", "1. 링크를 열고...\n2. ...을 눌러 보세요.", true, 5)}
        {area("credentials", "테스트 계정 (선택)", "로그인이 필요하면 다른 참가자가 쓸 계정을 적어 주세요. 실제 개인 계정은 쓰지 마세요.", false, 2)}

        {error && (
          <p role="alert" className="text-sm text-[var(--g-red)]">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm font-bold text-[var(--g-green)]">
            {notice}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {published ? (
            <>
              <button type="submit" disabled={saving || missing.length > 0} className={`${primaryBtn} px-5 py-2.5`}>
                변경사항 저장
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  entry &&
                  startSaving(async () => {
                    const res = await unpublishEntry(entry.id);
                    if (!res.ok) setError(res.error);
                    else setNotice("비공개로 바꿨습니다.");
                  })
                }
                className={smallBtn}
              >
                비공개로 전환
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={saving || missing.length > 0}
                onClick={() => save(true)}
                className={`${primaryBtn} px-5 py-2.5`}
              >
                공개하기
              </button>
              <button type="button" disabled={saving} onClick={() => save(false)} className={smallBtn}>
                임시 저장
              </button>
            </>
          )}
          {entry &&
            (armDelete ? (
              <span className="ml-auto inline-flex gap-1">
                <button
                  type="button"
                  onClick={() =>
                    startSaving(async () => {
                      const res = await deleteEntry(entry.id);
                      if (!res.ok) setError(res.error);
                      else setForm(toInput());
                      setArmDelete(false);
                    })
                  }
                  className="border border-[var(--g-red)] px-2.5 py-1.5 text-sm font-bold text-[var(--g-red)]"
                >
                  삭제 확인
                </button>
                <button type="button" onClick={() => setArmDelete(false)} className={smallBtn}>
                  취소
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setArmDelete(true)} className={`${smallBtn} ml-auto text-fg/60`}>
                데모 삭제
              </button>
            ))}
        </div>
        {missing.length > 0 && (
          <p className="text-xs text-fg/50">공개하려면 {missing.join(", ")}을(를) 입력해 주세요.</p>
        )}
      </form>

      <div className="grid gap-6 border-t border-fg/10 p-5 sm:grid-cols-2 sm:p-7">
        {entry ? (
          <>
            <Uploads kind="image" title="스크린샷" entry={entry} teamId={team.id} />
            <Uploads kind="file" title="파일 (APK, PDF 등)" entry={entry} teamId={team.id} />
          </>
        ) : (
          <p className="text-sm text-fg/50 sm:col-span-2">먼저 임시 저장하면 스크린샷과 파일을 올릴 수 있습니다.</p>
        )}
      </div>
    </section>
  );
}

// Browser -> Storage upload (Server Actions have body size limits), then the action registers the row.
function Uploads({ kind, title, entry, teamId }: { kind: AssetKind; title: string; entry: MarketEntry; teamId: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const rule = ASSET_RULES[kind];
  const list: MarketAsset[] = kind === "image" ? entry.images : entry.files;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const picked = Array.from(files).slice(0, rule.max - list.length);
    setBusy(true);
    const supabase = createClient();
    for (const file of picked) {
      const type = contentTypeOf(file, kind);
      if (file.size > rule.bytes) {
        setError(`${file.name}: ${formatBytes(rule.bytes)}까지 올릴 수 있습니다.`);
        continue;
      }
      if (!(rule.types as readonly string[]).includes(type)) {
        setError(`${file.name}: 올릴 수 없는 형식입니다.`);
        continue;
      }
      const path = storagePath(teamId, entry.id, file.name);
      const up = await supabase.storage.from(rule.bucket).upload(path, file, { contentType: type, upsert: false });
      if (up.error) {
        setError(`${file.name}: 업로드하지 못했습니다.`);
        continue;
      }
      const res = await registerAsset({ entryId: entry.id, kind, path, fileName: file.name, mime: type, size: file.size });
      if (!res.ok) setError(`${file.name}: ${res.error}`);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold">{title}</p>
        <span className="tabular-nums text-xs text-fg/50">
          {list.length}/{rule.max} · 개당 {formatBytes(rule.bytes)}
        </span>
      </div>
      <ul className="mt-2 grid gap-1.5">
        {list.map((a) => (
          <AssetRow key={a.id} asset={a} onError={setError} />
        ))}
      </ul>
      {/* The native file button shows the browser's own (often English) text, so it's visually hidden */}
      <input
        ref={input}
        id={`${id}-file`}
        type="file"
        multiple
        accept={rule.accept}
        disabled={busy || list.length >= rule.max}
        onChange={(e) => upload(e.target.files)}
        className="peer sr-only"
      />
      <label
        htmlFor={`${id}-file`}
        className={`${smallBtn} mt-2 inline-flex cursor-pointer items-center gap-2 py-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-30`}
      >
        <span aria-hidden="true">＋</span>
        {kind === "image" ? "사진 올리기" : "파일 올리기"}
      </label>
      {busy && (
        <p role="status" className="mt-1 text-xs text-fg/50">
          올리는 중…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-[var(--g-red)]">
          {error}
        </p>
      )}
    </div>
  );
}

function AssetRow({ asset, onError }: { asset: MarketAsset; onError: (msg: string) => void }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center justify-between gap-3 border border-fg/15 px-3 py-1.5 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        {asset.kind === "image" && asset.url && (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          <img src={asset.url} alt="" className="h-8 w-12 shrink-0 bg-fg/5 object-cover" />
        )}
        <span className="truncate">{asset.fileName}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="tabular-nums text-xs text-fg/50">{formatBytes(asset.size)}</span>
        <button
          type="button"
          disabled={pending}
          aria-label={`${asset.fileName} 삭제`}
          onClick={() =>
            start(async () => {
              const res = await deleteAsset(asset.id);
              if (!res.ok) onError(res.error);
            })
          }
          className="grid h-6 w-6 place-items-center text-xs text-fg/50 transition hover:bg-fg/10 hover:text-fg disabled:opacity-30"
        >
          ✕
        </button>
      </span>
    </li>
  );
}
