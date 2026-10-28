"use client";

import { useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { schools } from "./brand";
import {
  event,
  faqs,
  notices,
  schedule,
  trackColor,
  tracks,
  venueInfo,
  type Track,
} from "@/data/guide";

const TABS = [
  { id: "overview", label: "개요" },
  { id: "timetable", label: "타임테이블" },
  { id: "sessions", label: "세션" },
  { id: "venue", label: "오시는 길" },
  { id: "faq", label: "FAQ" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const isTab = (v: string): v is TabId => TABS.some((t) => t.id === v);

// The active tab lives in the URL hash so it can be linked and survives reloads.
function readHash(): TabId {
  const h = window.location.hash.slice(1);
  return isTab(h) ? h : "overview";
}

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

function goTo(tab: TabId) {
  history.replaceState(null, "", `#${tab}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function GuideTabs() {
  const active = useSyncExternalStore(subscribeHash, readHash, () => "overview" as TabId);
  const base = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = TABS.findIndex((t) => t.id === active);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    goTo(TABS[next].id);
    tabRefs.current[next]?.focus();
  }

  function open(tab: TabId) {
    goTo(tab);
    document.getElementById(`${base}-bar`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      {/* Sticky tab bar */}
      <div id={`${base}-bar`} className="sticky top-0 z-10 border-b border-fg/10 bg-page/90 backdrop-blur">
        <div
          role="tablist"
          aria-label="행사 안내"
          onKeyDown={onKeyDown}
          className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-8"
        >
          {TABS.map((t, i) => {
            const selected = t.id === active;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                id={`${base}-tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`${base}-panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => goTo(t.id)}
                className={`relative shrink-0 px-3 py-4 text-sm font-semibold transition sm:px-4 sm:text-base ${
                  selected ? "text-fg" : "text-fg/50 hover:text-fg/80"
                }`}
              >
                {t.label}
                {selected && <span className="absolute inset-x-3 bottom-0 h-[3px] bg-fg sm:inset-x-4" />}
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`${base}-panel-${active}`}
        aria-labelledby={`${base}-tab-${active}`}
        className="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-14"
      >
        {active === "overview" && <Overview onOpen={open} />}
        {active === "timetable" && <Timetable />}
        {active === "sessions" && <Sessions />}
        {active === "venue" && <Venue />}
        {active === "faq" && <FaqList />}
      </div>
    </div>
  );
}

/* ---------- Shared bits ---------- */

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{title}</h2>
    </div>
  );
}

function TrackTag({ track }: { track: Track }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg/70">
      <span className="h-2.5 w-2.5" style={{ background: trackColor[track] }} />
      {track}
    </span>
  );
}

function TrackFilter({
  value,
  onChange,
  hideCommon = false,
}: {
  value: Track | "전체";
  onChange: (v: Track | "전체") => void;
  hideCommon?: boolean;
}) {
  const options: (Track | "전체")[] = ["전체", ...tracks.filter((t) => !hideCommon || t !== "공통")];
  return (
    <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="트랙 필터">
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o)}
            className={`inline-flex items-center gap-2 border px-3 py-1.5 text-sm transition ${
              on ? "border-fg bg-fg text-page" : "border-fg/20 text-fg/70 hover:border-fg/50"
            }`}
          >
            {o !== "전체" && <span className="h-2 w-2" style={{ background: trackColor[o] }} />}
            {o}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Panels ---------- */

const shortcuts: { tab: TabId; title: string; desc: string }[] = [
  { tab: "timetable", title: "타임테이블", desc: "시간대별 전체 일정과 장소" },
  { tab: "sessions", title: "세션", desc: "트랙별 세션 소개" },
  { tab: "venue", title: "오시는 길", desc: "장소 · 교통 · 체크인" },
  { tab: "faq", title: "FAQ", desc: "자주 묻는 질문" },
];

function Overview({ onOpen }: { onOpen: (t: TabId) => void }) {
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_22rem]">
      <div>
        <SectionTitle title="무엇을 찾으세요?" />
        <ul className="grid gap-px border border-fg/10 bg-fg/10 sm:grid-cols-2">
          {shortcuts.map((s, i) => (
            <li key={s.tab} className="bg-page">
              <button
                type="button"
                onClick={() => onOpen(s.tab)}
                className="group flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-fg/[0.04]"
              >
                <span className="flex items-start gap-3">
                  <span className="mt-1 h-4 w-1" style={{ background: schools[i].light }} />
                  <span>
                    <span className="block text-lg font-semibold text-fg">{s.title}</span>
                    <span className="block text-sm text-fg/60">{s.desc}</span>
                  </span>
                </span>
                <span className="text-fg/40 transition group-hover:translate-x-1 group-hover:text-fg" aria-hidden="true">
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-12">
          <SectionTitle title="네 개의 캠퍼스, 하나의 DevFest" />
          <p className="max-w-2xl leading-relaxed text-fg/70">
            고려대 · 연세대 · 성균관대 · KAIST의 GDG on Campus가 함께 준비한 개발자 행사입니다. 올해의 주제{" "}
            <strong className="font-semibold text-fg">{event.theme}</strong> 아래, 각자가 그리는 기술의 다음 모습을 나눕니다.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {schools.map((s) => (
              <li key={s.key} className="inline-flex items-center gap-2 border border-fg/15 py-1.5 pl-1.5 pr-3 text-sm text-fg">
                <span className="flex h-5 w-5">
                  <span className="flex-1" style={{ background: s.dark }} />
                  <span className="flex-1" style={{ background: s.light }} />
                </span>
                GDG on Campus {s.word}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <aside>
        <SectionTitle title="공지사항" />
        <ul className="border-t border-fg/15">
          {notices.map((n) => (
            <li key={n.title} className="flex items-baseline gap-4 border-b border-fg/15 py-4">
              <span className="w-12 shrink-0 font-mono text-xs text-fg/50">{n.date}</span>
              <span className="text-fg">{n.title}</span>
              {n.tag && <span className="ml-auto bg-[var(--g-red)] px-1.5 py-0.5 text-[10px] font-bold text-white">{n.tag}</span>}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function Timetable() {
  const [filter, setFilter] = useState<Track | "전체">("전체");
  const rows = schedule.filter((s) => filter === "전체" || s.track === filter || s.track === "공통");

  return (
    <div>
      <SectionTitle title={`${event.date} 일정`} />
      <TrackFilter value={filter} onChange={setFilter} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-t border-fg/15 text-left">
          <thead className="sr-only">
            <tr>
              <th>시간</th>
              <th>세션</th>
              <th>트랙</th>
              <th>장소</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.time + r.title} className="border-b border-fg/15 align-top">
                <td className="w-32 py-4 pr-4 font-mono text-sm text-fg">
                  {r.time}
                  <span className="text-fg/40"> – {r.end}</span>
                </td>
                <td className="py-4 pr-4">
                  <p className="font-semibold text-fg">{r.title}</p>
                  {r.speaker && <p className="mt-0.5 text-sm text-fg/50">{r.speaker}</p>}
                </td>
                <td className="w-24 py-4 pr-4">
                  <TrackTag track={r.track} />
                </td>
                <td className="w-24 py-4 text-sm text-fg/60">{r.room}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-fg/50">* 세부 일정은 변경될 수 있습니다.</p>
    </div>
  );
}

function Sessions() {
  const [filter, setFilter] = useState<Track | "전체">("전체");
  const items = schedule.filter((s) => s.track !== "공통" && (filter === "전체" || s.track === filter));

  return (
    <div>
      <SectionTitle title="트랙별 세션" />
      <TrackFilter value={filter} onChange={setFilter} hideCommon />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => (
          <li key={s.title} className="flex flex-col border border-fg/15 bg-surface">
            <span className="h-1" style={{ background: trackColor[s.track] }} />
            <div className="flex flex-1 flex-col p-5">
              <TrackTag track={s.track} />
              <h3 className="mt-3 text-lg font-semibold leading-snug text-fg">{s.title}</h3>
              {s.desc && <p className="mt-2 text-sm leading-relaxed text-fg/60">{s.desc}</p>}
              <p className="mt-auto pt-5 font-mono text-xs text-fg/50">
                {s.time}–{s.end} · {s.room} · {s.speaker}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {items.length === 0 && <p className="text-fg/60">이 트랙의 세션은 준비 중입니다.</p>}
    </div>
  );
}

function Venue() {
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div>
        <SectionTitle title="오시는 길" />
        <dl className="border-t border-fg/15">
          {venueInfo.map((v) => (
            <div key={v.label} className="grid grid-cols-[5rem_1fr] gap-4 border-b border-fg/15 py-4">
              <dt className="text-sm text-fg/50">{v.label}</dt>
              <dd className="text-fg">{v.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 border border-fg/15 bg-surface p-5">
          <p className="font-semibold text-fg">체크인 안내</p>
          <p className="mt-1 text-sm leading-relaxed text-fg/70">
            {event.checkIn} 로비에서 체크인할 수 있습니다. 신청 완료 메일의 QR 코드를 준비해 주세요.
          </p>
        </div>
      </div>
      <div className="relative min-h-72 overflow-hidden border border-fg/15 bg-surface">
        {/* Map placeholder */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(var(--fg) 1px, transparent 1px), linear-gradient(90deg, var(--fg) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(circle at center, rgba(0,0,0,.12), transparent 75%)",
          }}
        />
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <span className="mx-auto block h-4 w-4 rotate-45" style={{ background: "var(--g-red)" }} />
            <p className="mt-3 font-semibold text-fg">{event.venue}</p>
            <p className="text-sm text-fg/50">지도는 추후 공개됩니다</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqList() {
  return (
    <div className="max-w-3xl">
      <SectionTitle title="자주 묻는 질문" />
      <div className="border-t border-fg/15">
        {faqs.map((f) => (
          <details key={f.q} className="group border-b border-fg/15">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-semibold text-fg [&::-webkit-details-marker]:hidden">
              {f.q}
              <span className="text-xl leading-none text-fg/50 transition group-open:rotate-45" aria-hidden="true">
                +
              </span>
            </summary>
            <p className="pb-5 leading-relaxed text-fg/70">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
