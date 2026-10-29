"use client";

// Demo Market cards and the detail view, shared by participants (/onfestival) and staff (/organize).

import type { ReactNode } from "react";
import { formatBytes } from "@/lib/festival/market-rules";
import type { MarketEntry, Participant, Team } from "@/lib/festival/types";
import { Label, MemberStripe, smallBtn } from "../festival-ui";

export const entryTitle = (e: MarketEntry, team?: Team) => e.title || team?.project || team?.name || "제목 없음";

export function StatusChip({ entry }: { entry: MarketEntry }) {
  if (entry.hidden)
    return <span className="shrink-0 bg-[var(--g-red)] px-1.5 py-0.5 text-[10px] font-bold text-paper">운영진 숨김</span>;
  if (entry.status === "draft")
    return <span className="shrink-0 border border-fg/30 px-1.5 py-0.5 text-[10px] font-bold text-fg/70">초안</span>;
  return <span className="shrink-0 bg-[var(--g-green)] px-1.5 py-0.5 text-[10px] font-bold text-paper">공개</span>;
}

export function ExternalLink({ href, children, strong = false }: { href: string; children: ReactNode; strong?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        strong
          ? "inline-flex items-center gap-2 bg-fg px-4 py-2 text-sm font-bold text-page transition hover:opacity-85"
          : `${smallBtn} inline-flex items-center gap-1.5`
      }
    >
      {children}
      <span aria-hidden="true">↗</span>
    </a>
  );
}

export function MarketCard({
  entry,
  team,
  members,
  mine,
  onOpen,
}: {
  entry: MarketEntry;
  team?: Team;
  members: Participant[];
  mine: boolean;
  onOpen: () => void;
}) {
  const cover = entry.images[0];
  return (
    <li className={`flex flex-col border ${mine ? "border-fg/50" : "border-fg/15"}`}>
      {cover?.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, nothing to optimize
        <img src={cover.url} alt="" className="aspect-[16/9] w-full bg-fg/5 object-cover" />
      ) : (
        <MemberStripe people={members} className="aspect-[16/9] w-full" />
      )}
      <div className="flex flex-1 flex-col p-5">
        <p className="flex items-center gap-2 text-xs text-fg/50">
          <span className="truncate tabular-nums">
            {team?.table} · {team?.name}
          </span>
          {mine && <span className="shrink-0 bg-fg px-1.5 py-0.5 text-[10px] font-bold text-page">MY</span>}
          {(entry.status === "draft" || entry.hidden) && <StatusChip entry={entry} />}
        </p>
        <h3 className="mt-2 text-xl font-bold leading-snug">{entryTitle(entry, team)}</h3>
        <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-fg/60">{entry.description}</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          {entry.liveUrl && (
            <ExternalLink href={entry.liveUrl} strong>
              서비스 열기
            </ExternalLink>
          )}
          <button type="button" onClick={onOpen} className={smallBtn}>
            자세히 · 테스트 방법
          </button>
        </div>
      </div>
    </li>
  );
}

export function MarketDetail({
  entry,
  team,
  members,
  onBack,
  actions,
}: {
  entry: MarketEntry;
  team?: Team;
  members: Participant[];
  onBack: () => void;
  actions?: ReactNode;
}) {
  return (
    <article aria-labelledby="market-detail" className="grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className={smallBtn}>
          ← 목록
        </button>
        {actions}
      </div>

      <header className="border border-fg/15">
        <MemberStripe people={members} className="h-2" />
        <div className="p-5 sm:p-7">
          <p className="flex flex-wrap items-center gap-2 text-sm text-fg/60">
            <span className="tabular-nums">{team?.table}</span> · {team?.name}
            <StatusChip entry={entry} />
          </p>
          <h2 id="market-detail" className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {entryTitle(entry, team)}
          </h2>
          {entry.hidden && entry.hiddenReason && (
            <p className="mt-2 text-sm text-[var(--g-red)]">숨김 사유: {entry.hiddenReason}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {entry.liveUrl && (
              <ExternalLink href={entry.liveUrl} strong>
                서비스 열기
              </ExternalLink>
            )}
            {entry.repoUrl && <ExternalLink href={entry.repoUrl}>코드 저장소</ExternalLink>}
            {entry.videoUrl && <ExternalLink href={entry.videoUrl}>데모 영상</ExternalLink>}
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="grid content-start gap-8">
          <section aria-labelledby="md-desc">
            <Label id="md-desc">소개</Label>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-fg/80">{entry.description || "—"}</p>
          </section>
          {entry.images.length > 0 && (
            <section aria-labelledby="md-shots">
              <Label id="md-shots">스크린샷</Label>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {entry.images.map((img) =>
                  img.url ? (
                    <li key={img.id}>
                      <a href={img.url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                        <img src={img.url} alt={img.caption || img.fileName} className="w-full border border-fg/10 bg-fg/5" />
                      </a>
                      {img.caption && <p className="mt-1 text-xs text-fg/50">{img.caption}</p>}
                    </li>
                  ) : null,
                )}
              </ul>
            </section>
          )}
        </div>

        <aside className="grid content-start gap-6">
          <section aria-labelledby="md-test" className="border border-fg/15 bg-fg/[0.04] p-5">
            <Label id="md-test">테스트 방법</Label>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{entry.testInstructions || "—"}</p>
            {entry.credentials && (
              <div className="mt-4 border-t border-fg/10 pt-4">
                <p className="text-xs text-fg/50">테스트 계정</p>
                <p className="mt-1 whitespace-pre-line break-all text-sm tabular-nums">{entry.credentials}</p>
              </div>
            )}
          </section>
          {entry.files.length > 0 && (
            <section aria-labelledby="md-files">
              <Label id="md-files">파일</Label>
              <ul className="mt-3 grid gap-2">
                {entry.files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 border border-fg/15 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{f.fileName}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="tabular-nums text-xs text-fg/50">{formatBytes(f.size)}</span>
                      {f.url && (
                        <a href={f.url} className="font-bold underline underline-offset-4">
                          받기
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </article>
  );
}
