"use client";

// UI bits shared by the participant (/onfestival) and admin (/organize) screens.

import Link from "next/link";
import { useRef, useSyncExternalStore, type ReactNode } from "react";
import { GdgLogo, schools, type School } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { event, type Participant, type SchoolKey } from "@/data/guide";

export const school = (key: SchoolKey) => schools.find((s) => s.key === key) as School;

// Schools represented in a group of people, in the standard school order
export const schoolsOf = (people: Participant[]) => schools.filter((s) => people.some((p) => p.school === s.key));

// One height scale for every control, so fields, selects and buttons in a row line up:
// sm 36px (inside tables and lists), md 40px (forms), lg 48px (a screen's main action).
export type ControlSize = "sm" | "md" | "lg";

// Form fields stay at 16px text: iOS Safari zooms the page into any smaller field on focus.
// Field borders are fg/50 (about 3.3:1), enough to see where a field is (WCAG 1.4.11).
const fieldBase = "border border-fg/50 bg-page text-fg placeholder:text-subtle outline-none transition focus:border-fg";
const fieldSize: Record<ControlSize, string> = { sm: "h-9 text-base", md: "h-10 text-base", lg: "h-12 text-lg" };

// A bare field; the caller sets its width
export const field = (size: ControlSize = "md") => `${fieldBase} ${fieldSize[size]} px-3`;

// A full-width field under its label text
export const fieldCls = `mt-1.5 w-full ${field()}`;

export const textareaCls = `mt-1.5 w-full ${fieldBase} px-3 py-2 text-base`;

// Selects drop the native look (macOS draws its own arrow and padding) and take the
// field's border, height and a square chevron (.select-chevron in globals.css).
export const select = (size: ControlSize = "md") =>
  `${fieldBase} ${fieldSize[size]} select-chevron cursor-pointer appearance-none pl-3 pr-9`;

const btnBase = "inline-flex shrink-0 items-center justify-center gap-2 font-bold transition disabled:opacity-30";
const btnSize: Record<ControlSize, string> = { sm: "h-9 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-12 px-5 text-base" };
const btnKind = {
  primary: "bg-fg text-page hover:opacity-85",
  secondary: "border border-fg/25 hover:bg-fg/10",
  danger: "border border-danger text-danger hover:bg-fg/10",
  // Filled KU red for a step that deletes data (bulk import with deletions)
  destructive: "bg-ku text-paper hover:opacity-85",
};

export const btn = (kind: keyof typeof btnKind, size: ControlSize = "md") => `${btnBase} ${btnSize[size]} ${btnKind[kind]}`;

export const primaryBtn = btn("primary");

export const secondaryBtn = btn("secondary");

export function Label({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="tabular-nums text-sm font-bold text-fg">
      {children}
    </h2>
  );
}

export function SchoolChip({ s, className = "h-4 w-4" }: { s: School; className?: string }) {
  return (
    <span className={`block shrink-0 ${className}`} title={s.name} style={{ background: s.main }} />
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
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-fg">
      <span className="h-1.5 w-1.5 bg-ok" />
      출석
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-subtle">
      <span className="h-1.5 w-1.5 bg-fg/30" />
      미출석
    </span>
  );
}

export type ScreenTab<T extends string> = { id: T; label: string };

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

// Active tab lives in the URL hash (#invest etc.) so it can be linked and survives reloads,
// same as the guide tabs on the main page.
export function useHashTab<T extends string>(tabs: readonly ScreenTab<T>[], fallback: T) {
  const active = useSyncExternalStore(
    subscribeHash,
    () => {
      const h = window.location.hash.slice(1);
      return tabs.some((t) => t.id === h) ? (h as T) : fallback;
    },
    () => fallback,
  );
  function setActive(id: T) {
    history.replaceState(null, "", `#${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
  return [active, setActive] as const;
}

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
      {/* Plain header in the page's own colors, like the home page's top row */}
      <header className="sticky top-0 z-10 border-b border-fg/15 bg-page">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2 text-sm font-bold sm:text-base">
            <GdgLogo className="h-3 w-6 shrink-0" />
            <span className="truncate">{event.series}</span>
            {badge && <span className="shrink-0 bg-fg px-1.5 py-0.5 text-[11px] font-bold text-page">{badge}</span>}
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {actions}
            <ThemeToggle className="h-10 w-10" />
            {/* Phones: icon only, so the name isn't cut off */}
            <Link
              href="/"
              aria-label="나가기"
              className="inline-flex h-10 min-w-10 items-center justify-center gap-2 border border-fg/25 px-2.5 text-sm font-bold transition hover:bg-fg/10 sm:px-4"
            >
              <span className="hidden sm:inline">나가기</span> <span aria-hidden="true">✕</span>
            </Link>
          </div>
        </div>
        {tabs.length > 0 && (
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
                  className={`relative shrink-0 px-3 py-3 text-sm font-bold transition sm:text-base ${on ? "text-fg" : "text-subtle hover:text-fg"}`}
                >
                  {t.label}
                  {on && <span className="absolute inset-x-3 bottom-0 h-[3px] bg-fg" />}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div
        {...(tabs.length > 0 ? { role: "tabpanel", id: "screen-panel", "aria-labelledby": `tab-${active}` } : {})}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-10"
      >
        {children}
      </div>

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
