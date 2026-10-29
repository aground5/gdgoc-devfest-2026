"use client";

import { useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { schools } from "./brand";
import {
  awards,
  criteria,
  days,
  event,
  faqs,
  investRules,
  keywords,
  notices,
  schedule,
  steps,
  venueInfo,
} from "@/data/guide";

const TABS = [
  { id: "overview", label: "개요" },
  { id: "timetable", label: "타임테이블" },
  { id: "program", label: "진행 방식" },
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
                className={`relative shrink-0 px-3 py-4 text-sm font-bold transition sm:px-4 sm:text-base ${
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
        {active === "program" && <Program />}
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
      <h2 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">{title}</h2>
    </div>
  );
}

/* ---------- Panels ---------- */

const shortcuts: { tab: TabId; title: string; desc: string }[] = [
  { tab: "timetable", title: "타임테이블", desc: "온라인 OT · Demo Day 일정" },
  { tab: "program", title: "진행 방식", desc: "팀빌딩 · 모의 투자 · 심사 기준" },
  { tab: "venue", title: "오시는 길", desc: "장소 · 운영 시간 · 소통 채널" },
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
                  <span className="mt-1 h-4 w-1" style={{ background: schools[i].main }} />
                  <span>
                    <span className="block text-lg font-bold text-fg">{s.title}</span>
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
          <SectionTitle title={event.title} />
          <p className="max-w-2xl leading-relaxed text-fg/70">{event.concept}</p>
          <p className="mt-3 max-w-2xl leading-relaxed text-fg/70">
            고려대 · 연세대 · 성균관대 · KAIST의 GDG on Campus가 함께 준비했고, {event.venue}에서 열립니다. 올해의 주제{" "}
            <strong className="font-bold text-fg">{event.theme}</strong>
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
              <span className="w-12 shrink-0 tabular-nums text-xs text-fg/50">{n.date}</span>
              <span className="text-fg">{n.title}</span>
              {n.tag && <span className="ml-auto bg-[var(--g-red)] px-1.5 py-0.5 text-[10px] font-bold text-paper">{n.tag}</span>}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function Timetable() {
  const [day, setDay] = useState(days[days.length - 1].id);
  const current = days.find((d) => d.id === day) ?? days[0];
  const rows = schedule.filter((s) => s.day === day);

  return (
    <div>
      <SectionTitle title="일정" />
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="날짜 선택">
        {days.map((d) => {
          const on = d.id === day;
          return (
            <button
              key={d.id}
              type="button"
              aria-pressed={on}
              onClick={() => setDay(d.id)}
              className={`border px-3 py-1.5 text-sm transition ${
                on ? "border-fg bg-fg text-page" : "border-fg/20 text-fg/70 hover:border-fg/50"
              }`}
            >
              <span className="tabular-nums">{d.date}</span> · {d.label}
            </button>
          );
        })}
      </div>
      <p className="mb-3 text-sm text-fg/60">
        {current.date} · {current.where}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] border-t border-fg/15 text-left">
          <thead className="sr-only">
            <tr>
              <th>시간</th>
              <th>내용</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.time + r.title} className="border-b border-fg/15 align-top">
                <td className="w-32 py-4 pr-4 tabular-nums text-sm text-fg">
                  {r.time}
                  <span className="text-fg/40"> – {r.end}</span>
                </td>
                <td className="py-4">
                  <p className="font-bold text-fg">{r.title}</p>
                  {r.desc && <p className="mt-0.5 text-sm text-fg/60">{r.desc}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-fg/50">* 세부 일정은 변경될 수 있습니다.</p>
    </div>
  );
}

function Program() {
  return (
    <div className="grid gap-14">
      <section>
        <SectionTitle title="Demo Day까지" />
        <ol className="grid gap-px border border-fg/10 bg-fg/10 md:grid-cols-5">
          {steps.map((st, i) => (
            <li key={st.title} className="flex flex-col bg-page p-5">
              <span className="h-1 w-8" style={{ background: schools[i % schools.length].main }} aria-hidden="true" />
              <p className="mt-4 tabular-nums text-xs text-fg/50">{st.date}</p>
              <h3 className="mt-1 text-lg font-bold text-fg">{st.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg/60">{st.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <SectionTitle title="키워드 기반 팀빌딩" />
        <p className="max-w-2xl leading-relaxed text-fg/70">
          정해진 트랙 대신 넓은 키워드로 팀을 꾸립니다. 신청할 때 1~3지망을 고르면, 수요에 맞춰 키워드를 합치거나 조정해 팀당 5~6명으로 구성합니다.
        </p>
        <ul className="mt-6 flex flex-wrap gap-2">
          {keywords.map((k) => (
            <li key={k} className="border border-fg/15 px-3 py-1.5 text-sm text-fg">
              {k}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-12 lg:grid-cols-2">
        <section>
          <SectionTitle title="모의 투자" />
          <ul className="border-t border-fg/15">
            {investRules.map((r) => (
              <li key={r} className="flex gap-3 border-b border-fg/15 py-4 text-fg/80">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-fg" aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionTitle title="심사 기준" />
          <dl className="border-t border-fg/15">
            {criteria.map((c) => (
              <div key={c.name} className="grid grid-cols-[6.5rem_1fr] gap-4 border-b border-fg/15 py-4">
                <dt className="font-bold text-fg">{c.name}</dt>
                <dd className="text-fg/70">{c.desc}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-fg/60">기술 스택 제한은 없으며, Google 기술을 활용하면 가산점이 있습니다.</p>
        </section>
      </div>

      <section>
        <SectionTitle title="시상" />
        <ul className="flex flex-wrap gap-2">
          {awards.map((a) => (
            <li key={a} className="border border-fg/15 bg-surface px-4 py-2 font-bold text-fg">
              {a}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-fg/60">인기상은 개미 투자를 가장 많이 받은 팀에게 돌아갑니다. 상세 시상 내역은 추후 공지됩니다.</p>
      </section>
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
          <p className="font-bold text-fg">체크인 안내</p>
          <p className="mt-1 text-sm leading-relaxed text-fg/70">
            {event.checkIn} 체크인할 수 있고, 체크인 후 Demo Market이 시작됩니다. 체크인 방법은 추후 안내됩니다.
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
            <p className="mt-3 font-bold text-fg">{event.venue}</p>
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
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-bold text-fg [&::-webkit-details-marker]:hidden">
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
