"use client";

// UI bits shared by the participant (/onfestival) and admin (/organize) screens.

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { GdgLogo, GoogleBar, schools, type School } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { event, type Participant, type SchoolKey } from "@/data/guide";

export const school = (key: SchoolKey) => schools.find((s) => s.key === key) as School;

// Schools represented in a group of people, in the standard school order
export const schoolsOf = (people: Participant[]) => schools.filter((s) => people.some((p) => p.school === s.key));

export const fieldCls =
  "mt-1.5 w-full border border-fg/20 bg-fg/[0.04] px-3 py-2.5 text-fg placeholder:text-fg/30 outline-none transition focus:border-fg/60";

export const selectCls = "border border-fg/20 bg-page px-2 py-2 text-sm text-fg outline-none transition focus:border-fg/60";

export const smallBtn = "border border-fg/25 px-3 py-1.5 text-sm font-semibold transition hover:bg-fg/10 disabled:opacity-30";

export const primaryBtn = "bg-fg px-4 py-2 text-sm font-semibold text-page transition hover:opacity-85 disabled:opacity-30";

export function Label({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-fg/60">
      {children}
    </h2>
  );
}

export function SchoolChip({ s, className = "h-4 w-4" }: { s: School; className?: string }) {
  return (
    <span className={`flex shrink-0 ${className}`} title={s.name}>
      <span className="flex-1" style={{ background: s.dark }} />
      <span className="flex-1" style={{ background: s.light }} />
    </span>
  );
}

// One color pair per person, so a mixed team shows its mix
export function MemberStripe({ people, className = "h-2" }: { people: Participant[]; className?: string }) {
  return (
    <div className={`flex bg-fg/10 ${className}`} aria-hidden="true">
      {people.map((p) => (
        <SchoolChip key={p.id} s={school(p.school)} className="h-full flex-1" />
      ))}
    </div>
  );
}

export function Status({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[var(--g-green)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--g-green)]" />
      출석
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-fg/40">
      <span className="h-1.5 w-1.5 rounded-full bg-fg/30" />
      미출석
    </span>
  );
}

export type ScreenTab<T extends string> = { id: T; label: string };

// Page frame: header with brand, theme toggle, exit link, and an ARIA tab bar.
export function ScreenFrame<T extends string>({
  badge,
  tabs,
  active,
  onTab,
  actions,
  children,
}: {
  badge?: string;
  tabs: readonly ScreenTab<T>[];
  active: T;
  onTab: (id: T) => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.id === active);
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    onTab(tabs[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div className="flex min-h-svh flex-col bg-page text-fg">
      <header className="sticky top-0 z-10 border-b border-fg/10 bg-page">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-4 sm:px-8">
          <p className="flex min-w-0 items-center gap-2 text-sm font-semibold sm:text-base">
            <GdgLogo className="h-3 w-6 shrink-0" />
            <span className="truncate">{event.series}</span>
            {badge && <span className="shrink-0 bg-fg px-1.5 py-0.5 text-[11px] font-bold text-page">{badge}</span>}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <ThemeToggle className="h-10 w-10" />
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 border border-fg/25 px-4 text-sm font-semibold transition hover:bg-fg/10"
            >
              나가기 <span aria-hidden="true">✕</span>
            </Link>
          </div>
        </div>
        <div role="tablist" onKeyDown={onKey} className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-8">
          {tabs.map((t, i) => {
            const on = t.id === active;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={on}
                aria-controls="screen-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => onTab(t.id)}
                className={`relative shrink-0 px-3 py-3 text-sm font-semibold transition sm:text-base ${on ? "text-fg" : "text-fg/50 hover:text-fg/80"}`}
              >
                {t.label}
                {on && <span className="absolute inset-x-3 bottom-0 h-[3px] bg-fg" />}
              </button>
            );
          })}
        </div>
      </header>

      <div
        role="tabpanel"
        id="screen-panel"
        aria-labelledby={`tab-${active}`}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-10"
      >
        {children}
      </div>

      <GoogleBar horizontal className="h-1.5 shrink-0" />
    </div>
  );
}

// Ranked bars for project totals (used by the published snapshot and the admin live view)
export function RankBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-1.5 w-full bg-fg/10" aria-hidden="true">
      <div className="h-full bg-fg" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </div>
  );
}
