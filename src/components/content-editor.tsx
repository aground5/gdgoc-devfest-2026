"use client";

// 행사 정보 tab on /organize: edit the guide page content section by section.
// Each section is saved as one site_content row; the public page is then
// revalidated so the change shows up right away.

import { useId, useState } from "react";
import type { ContentKey, SiteContent } from "@/data/guide";
import { patch, run, useSiteContent } from "@/lib/db/hooks";
import { saveContent } from "@/lib/db/queries";
import { Label, fieldCls, primaryBtn, smallBtn } from "./festival-ui";

type Field = { key: string; label: string; multiline?: boolean; optional?: boolean; wide?: boolean };

type Section =
  | { key: ContentKey; label: string; kind: "object"; fields: Field[] }
  | { key: ContentKey; label: string; kind: "list"; fields: Field[]; item: string }
  | { key: ContentKey; label: string; kind: "strings"; item: string; multiline?: boolean };

const SECTIONS: Section[] = [
  {
    key: "event",
    label: "행사 기본 정보",
    kind: "object",
    fields: [
      { key: "series", label: "시리즈" },
      { key: "theme", label: "주제" },
      { key: "title", label: "행사명", wide: true },
      { key: "concept", label: "소개", multiline: true, wide: true },
      { key: "date", label: "날짜" },
      { key: "hours", label: "운영 시간" },
      { key: "checkIn", label: "체크인" },
      { key: "venue", label: "장소" },
      { key: "registerUrl", label: "신청 링크", wide: true },
    ],
  },
  {
    key: "notices",
    label: "공지",
    kind: "list",
    item: "공지",
    fields: [
      { key: "date", label: "날짜" },
      { key: "title", label: "내용", wide: true },
      { key: "tag", label: "태그 (예: NEW)", optional: true },
    ],
  },
  {
    key: "steps",
    label: "Road to Demo Day",
    kind: "list",
    item: "단계",
    fields: [
      { key: "date", label: "날짜" },
      { key: "title", label: "제목" },
      { key: "desc", label: "설명", multiline: true, wide: true },
    ],
  },
  {
    key: "days",
    label: "타임테이블 날짜",
    kind: "list",
    item: "날짜",
    fields: [
      { key: "id", label: "ID (영문, 일정에서 사용)" },
      { key: "label", label: "이름" },
      { key: "date", label: "날짜" },
      { key: "where", label: "장소" },
    ],
  },
  {
    key: "schedule",
    label: "타임테이블 일정",
    kind: "list",
    item: "일정",
    fields: [
      { key: "day", label: "날짜 ID" },
      { key: "time", label: "시작" },
      { key: "end", label: "끝" },
      { key: "title", label: "제목", wide: true },
      { key: "desc", label: "설명", multiline: true, optional: true, wide: true },
    ],
  },
  { key: "keywords", label: "키워드", kind: "strings", item: "키워드" },
  { key: "investRules", label: "모의 투자 규칙", kind: "strings", item: "규칙", multiline: true },
  {
    key: "criteria",
    label: "심사 기준",
    kind: "list",
    item: "기준",
    fields: [
      { key: "name", label: "이름" },
      { key: "desc", label: "설명", wide: true },
    ],
  },
  { key: "awards", label: "시상", kind: "strings", item: "상" },
  {
    key: "faqs",
    label: "FAQ",
    kind: "list",
    item: "질문",
    fields: [
      { key: "q", label: "질문", wide: true },
      { key: "a", label: "답변", multiline: true, wide: true },
    ],
  },
  {
    key: "venueInfo",
    label: "오시는 길",
    kind: "list",
    item: "항목",
    fields: [
      { key: "label", label: "항목" },
      { key: "value", label: "내용", wide: true },
    ],
  },
];

type Row = Record<string, string>;

// Trim every field and drop empty optional ones; returns an error message if a required field is empty
function clean(section: Section, value: unknown): { value: unknown } | { error: string } {
  const tidyRow = (row: Row, fields: Field[], where: string) => {
    const out: Row = {};
    for (const f of fields) {
      const v = (row[f.key] ?? "").trim();
      if (!v && !f.optional) throw new Error(`${where}의 "${f.label}"을(를) 입력해 주세요.`);
      if (v) out[f.key] = v;
    }
    return out;
  };
  try {
    if (section.kind === "object") return { value: tidyRow(value as Row, section.fields, section.label) };
    if (section.kind === "list") return { value: (value as Row[]).map((r, i) => tidyRow(r, section.fields, `${section.item} ${i + 1}`)) };
    const list = (value as string[]).map((v) => v.trim());
    if (list.some((v) => !v)) throw new Error(`비어 있는 ${section.item}이(가) 있습니다.`);
    return { value: list };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

async function revalidateGuide() {
  try {
    await fetch("/api/revalidate-content", { method: "POST" });
  } catch {
    // The page also refreshes on its own every minute
  }
}

export function ContentPanel() {
  const content = useSiteContent();
  const [open, setOpen] = useState<ContentKey>("event");

  if (content.isPending)
    return (
      <p className="py-10 text-fg/50" role="status">
        불러오는 중…
      </p>
    );
  if (content.error)
    return (
      <p role="alert" className="py-10 text-[var(--g-red)]">
        행사 정보를 불러오지 못했습니다. {content.error.message}
      </p>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <nav aria-label="행사 정보 항목">
        <ul className="grid gap-px border border-fg/10 bg-fg/10">
          {SECTIONS.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                aria-current={open === s.key}
                onClick={() => setOpen(s.key)}
                className={`w-full bg-page px-4 py-2.5 text-left text-sm transition hover:bg-fg/[0.05] ${open === s.key ? "font-bold text-fg" : "text-fg/70"}`}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-fg/40">저장하면 메인 페이지에 바로 반영됩니다.</p>
      </nav>
      {SECTIONS.filter((s) => s.key === open).map((s) => (
        // key resets the draft when switching sections
        <SectionEditor key={s.key} section={s} saved={content.data[s.key]} />
      ))}
    </div>
  );
}

function SectionEditor({ section, saved }: { section: Section; saved: SiteContent[ContentKey] }) {
  const id = useId();
  const [draft, setDraft] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const value = draft ?? saved;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);

  const edit = (next: unknown) => {
    setDraft(next);
    setError("");
    setDone(false);
  };

  async function save() {
    const r = clean(section, value);
    if ("error" in r) return setError(r.error);
    setBusy(true);
    const ok = await run(() => saveContent(section.key, r.value), patch.siteContent(section.key, r.value));
    setBusy(false);
    if (!ok) return;
    setDraft(null);
    setDone(true);
    void revalidateGuide();
  }

  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0 border border-fg/15 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label id={`${id}-title`}>{section.label}</Label>
        <span className="flex items-center gap-2">
          {dirty && (
            <button type="button" onClick={() => edit(null)} className={smallBtn}>
              되돌리기
            </button>
          )}
          <button type="button" onClick={save} disabled={!dirty || busy} className={primaryBtn}>
            {busy ? "저장 중…" : "저장"}
          </button>
        </span>
      </div>

      <div className="mt-4">
        {section.kind === "object" && <FieldsEditor fields={section.fields} row={value as Row} onChange={edit} />}
        {section.kind === "list" && <ListEditor section={section} rows={value as Row[]} onChange={edit} />}
        {section.kind === "strings" && <StringsEditor section={section} items={value as string[]} onChange={edit} />}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--g-red)]">
          {error}
        </p>
      )}
      {done && !dirty && (
        <p role="status" className="mt-3 text-sm text-[var(--g-green)]">
          저장했습니다.
        </p>
      )}
    </section>
  );
}

function FieldsEditor({ fields, row, onChange }: { fields: Field[]; row: Row; onChange: (row: Row) => void }) {
  const id = useId();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <label key={f.key} htmlFor={`${id}-${f.key}`} className={`text-xs text-fg/60 ${f.wide ? "sm:col-span-2" : ""}`}>
          {f.label}
          {f.multiline ? (
            <textarea
              id={`${id}-${f.key}`}
              rows={3}
              value={row[f.key] ?? ""}
              onChange={(e) => onChange({ ...row, [f.key]: e.target.value })}
              className={`${fieldCls} py-2`}
            />
          ) : (
            <input
              id={`${id}-${f.key}`}
              value={row[f.key] ?? ""}
              onChange={(e) => onChange({ ...row, [f.key]: e.target.value })}
              className={`${fieldCls} py-2`}
            />
          )}
        </label>
      ))}
    </div>
  );
}

// Move, remove and add buttons shared by both list editors
function RowControls({
  i,
  n,
  item,
  onMove,
  onRemove,
}: {
  i: number;
  n: number;
  item: string;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  return (
    <span className="flex shrink-0 gap-1">
      <button type="button" aria-label={`${item} ${i + 1} 위로`} disabled={i === 0} onClick={() => onMove(i - 1)} className={smallBtn}>
        ↑
      </button>
      <button
        type="button"
        aria-label={`${item} ${i + 1} 아래로`}
        disabled={i === n - 1}
        onClick={() => onMove(i + 1)}
        className={smallBtn}
      >
        ↓
      </button>
      <button type="button" aria-label={`${item} ${i + 1} 삭제`} onClick={onRemove} className={`${smallBtn} text-fg/60`}>
        삭제
      </button>
    </span>
  );
}

function move<T>(list: T[], from: number, to: number) {
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

function ListEditor({
  section,
  rows,
  onChange,
}: {
  section: Extract<Section, { kind: "list" }>;
  rows: Row[];
  onChange: (rows: Row[]) => void;
}) {
  return (
    <div className="grid gap-3">
      <ol className="grid gap-3">
        {rows.map((r, i) => (
          <li key={i} className="border border-fg/10 bg-fg/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-xs font-bold tabular-nums text-fg/50">
                {section.item} {i + 1}
              </span>
              <RowControls
                i={i}
                n={rows.length}
                item={section.item}
                onMove={(to) => onChange(move(rows, i, to))}
                onRemove={() => onChange(rows.filter((_, k) => k !== i))}
              />
            </div>
            <FieldsEditor fields={section.fields} row={r} onChange={(row) => onChange(rows.map((x, k) => (k === i ? row : x)))} />
          </li>
        ))}
      </ol>
      {rows.length === 0 && <p className="text-sm text-fg/50">항목이 없습니다.</p>}
      <button type="button" onClick={() => onChange([...rows, {}])} className={`${smallBtn} justify-self-start`}>
        + {section.item} 추가
      </button>
    </div>
  );
}

function StringsEditor({
  section,
  items,
  onChange,
}: {
  section: Extract<Section, { kind: "strings" }>;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="grid gap-2">
      <ol className="grid gap-2">
        {items.map((v, i) => (
          <li key={i} className="flex items-start gap-2">
            {section.multiline ? (
              <textarea
                aria-label={`${section.item} ${i + 1}`}
                rows={2}
                value={v}
                onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))}
                className={`${fieldCls} mt-0 min-w-0 flex-1 py-2`}
              />
            ) : (
              <input
                aria-label={`${section.item} ${i + 1}`}
                value={v}
                onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))}
                className={`${fieldCls} mt-0 min-w-0 flex-1 py-2`}
              />
            )}
            <RowControls
              i={i}
              n={items.length}
              item={section.item}
              onMove={(to) => onChange(move(items, i, to))}
              onRemove={() => onChange(items.filter((_, k) => k !== i))}
            />
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => onChange([...items, ""])} className={`${smallBtn} justify-self-start`}>
        + {section.item} 추가
      </button>
    </div>
  );
}
