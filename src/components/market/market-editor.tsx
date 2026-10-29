"use client";

// The team's own Demo Market entry: details, publish/unpublish, and uploads.
// Shown only to members of the team; the database rejects anyone else anyway.

import { useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { Team } from "@/data/guide";
import { patch, run } from "@/lib/db/hooks";
import {
  deleteDemo,
  deleteDemoAsset,
  saveDemo,
  unpublishDemo,
  uploadDemoAsset,
  type DemoAsset,
  type DemoEntry,
  type DemoInput,
} from "@/lib/db/queries";
import { ASSET_RULES, contentTypeOf, formatBytes, storagePath, type AssetKind } from "@/lib/market-rules";
import { Label, btn, fieldCls, secondaryBtn, textareaCls } from "../festival-ui";
import { StatusChip } from "./market-view";

const toInput = (e?: DemoEntry): DemoInput => ({
  title: e?.title ?? "",
  liveUrl: e?.liveUrl ?? "",
  repoUrl: e?.repoUrl ?? "",
  videoUrl: e?.videoUrl ?? "",
  description: e?.description ?? "",
  testInstructions: e?.testInstructions ?? "",
  credentials: e?.credentials ?? "",
});

export function MarketEditor({ team, entry }: { team: Team; entry?: DemoEntry }) {
  const id = useId();
  const [form, setForm] = useState<DemoInput>(() => toInput(entry));
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [armDelete, setArmDelete] = useState(false);

  const published = entry?.status === "published";
  const missing = [
    !form.liveUrl.trim() && "서비스 링크",
    !form.description.trim() && "소개",
    !form.testInstructions.trim() && "테스트 방법",
  ].filter(Boolean) as string[];

  const set = (key: keyof DemoInput) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [key]: e.target.value });
    setNotice("");
  };

  // The server decides the entry id, so no optimistic patch; run() shows failures in the toast
  async function act(write: () => Promise<unknown>, done: string, optimistic?: () => void) {
    setBusy(true);
    const saved = await run(write, optimistic);
    setBusy(false);
    if (saved) setNotice(done);
    return saved;
  }

  const save = (publish: boolean) =>
    act(
      () => saveDemo(team.id, form, publish),
      publish ? "공개되었습니다. 다른 팀이 데모 마켓에서 볼 수 있습니다." : "저장했습니다. 아직 우리 팀만 볼 수 있습니다.",
    );

  function submit(e: FormEvent) {
    e.preventDefault();
    void save(published);
  }

  const field = (key: keyof DemoInput, label: string, hint?: string, required = false) => (
    <label htmlFor={`${id}-${key}`} className="text-xs text-subtle">
      {label}
      {required && <span className="text-danger"> *</span>}
      <input id={`${id}-${key}`} value={form[key]} onChange={set(key)} className={fieldCls} placeholder={hint} />
    </label>
  );

  const area = (key: keyof DemoInput, label: string, hint: string, required = false, rows = 4) => (
    <label htmlFor={`${id}-${key}`} className="text-xs text-subtle">
      {label}
      {required && <span className="text-danger"> *</span>}
      <textarea id={`${id}-${key}`} value={form[key]} onChange={set(key)} rows={rows} placeholder={hint} className={textareaCls} />
    </label>
  );

  return (
    <section aria-labelledby={`${id}-title`} className="border border-fg/15 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-fg/10 px-5 py-4 sm:px-7">
        <div className="flex items-center gap-2">
          <Label id={`${id}-title`}>우리 팀 데모</Label>
          {entry && <StatusChip entry={entry} />}
        </div>
        <span className="text-xs text-subtle">{team.name} 팀원만 수정할 수 있습니다</span>
      </div>

      {entry?.hidden && (
        <p role="alert" className="mx-5 mt-5 border border-danger px-4 py-3 text-sm sm:mx-7">
          운영진이 이 데모를 숨겼습니다{entry.hiddenReason ? `: ${entry.hiddenReason}` : "."} 수정한 뒤 운영진에게 알려 주세요.
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

        {notice && (
          <p role="status" className="text-sm font-bold text-fg">
            {notice}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {published ? (
            <>
              <button type="submit" disabled={busy || missing.length > 0} className={btn("primary", "lg")}>
                변경사항 저장
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => entry && void act(() => unpublishDemo(entry.id), "비공개로 바꿨습니다.")}
                className={secondaryBtn}
              >
                비공개로 전환
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled={busy || missing.length > 0} onClick={() => void save(true)} className={btn("primary", "lg")}>
                공개하기
              </button>
              <button type="button" disabled={busy} onClick={() => void save(false)} className={secondaryBtn}>
                임시 저장
              </button>
            </>
          )}
          {entry &&
            (armDelete ? (
              <span className="ml-auto inline-flex gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (await act(() => deleteDemo(entry), "삭제했습니다.", patch.removeDemo(entry.id))) setForm(toInput());
                    setArmDelete(false);
                  }}
                  className={btn("danger")}
                >
                  삭제 확인
                </button>
                <button type="button" onClick={() => setArmDelete(false)} className={secondaryBtn}>
                  취소
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setArmDelete(true)} className={`${secondaryBtn} ml-auto text-subtle`}>
                데모 삭제
              </button>
            ))}
        </div>
        {missing.length > 0 && <p className="text-xs text-subtle">공개하려면 {missing.join(", ")}을(를) 입력해 주세요.</p>}
      </form>

      <div className="grid gap-6 border-t border-fg/10 p-5 sm:grid-cols-2 sm:p-7">
        {entry ? (
          <>
            <Uploads kind="image" title="스크린샷" entry={entry} />
            <Uploads kind="file" title="파일 (APK, PDF 등)" entry={entry} />
          </>
        ) : (
          <p className="text-sm text-subtle sm:col-span-2">먼저 임시 저장하면 스크린샷과 파일을 올릴 수 있습니다.</p>
        )}
      </div>
    </section>
  );
}

// Uploads go straight from the browser to Storage, then the row is written.
function Uploads({ kind, title, entry }: { kind: AssetKind; title: string; entry: DemoEntry }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const rule = ASSET_RULES[kind];
  const list: DemoAsset[] = kind === "image" ? entry.images : entry.files;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    setBusy(true);
    for (const file of Array.from(files).slice(0, rule.max - list.length)) {
      const type = contentTypeOf(file, kind);
      if (file.size > rule.bytes) {
        setError(`${file.name}: ${formatBytes(rule.bytes)}까지 올릴 수 있습니다.`);
        continue;
      }
      if (!(rule.types as readonly string[]).includes(type)) {
        setError(`${file.name}: 올릴 수 없는 형식입니다.`);
        continue;
      }
      await run(() => uploadDemoAsset(entry.teamId, entry.id, kind, file, storagePath(entry.teamId, entry.id, file.name), type));
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold">{title}</p>
        <span className="tabular-nums text-xs text-subtle">
          {list.length}/{rule.max} · 개당 {formatBytes(rule.bytes)}
        </span>
      </div>
      <ul className="mt-2 grid gap-1.5">
        {list.map((a) => (
          <AssetRow key={a.id} asset={a} />
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
        onChange={(e) => void upload(e.target.files)}
        className="peer sr-only"
      />
      <label
        htmlFor={`${id}-file`}
        className={`${secondaryBtn} mt-2 cursor-pointer peer-focus-visible:outline peer-focus-visible:outline-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-30`}
      >
        <span aria-hidden="true">＋</span>
        {busy ? "올리는 중…" : kind === "image" ? "사진 올리기" : "파일 올리기"}
      </label>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function AssetRow({ asset }: { asset: DemoAsset }) {
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
        <span className="tabular-nums text-xs text-subtle">{formatBytes(asset.size)}</span>
        <button
          type="button"
          aria-label={`${asset.fileName} 삭제`}
          onClick={() => void run(() => deleteDemoAsset(asset), patch.removeDemoAsset(asset.id))}
          className="grid h-8 w-8 place-items-center text-xs text-subtle transition hover:bg-fg/10 hover:text-fg"
        >
          ✕
        </button>
      </span>
    </li>
  );
}
