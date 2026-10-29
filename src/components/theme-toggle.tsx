"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const QUERY = "(prefers-color-scheme: dark)";

function getTheme(): Theme {
  const t = document.documentElement.dataset.theme;
  if (t === "light" || t === "dark") return t;
  return window.matchMedia(QUERY).matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  window.addEventListener("themechange", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener("themechange", onChange);
  };
}

function setTheme(next: Theme) {
  const root = document.documentElement;
  // Switch every color in the same frame: without this, elements with a color
  // transition (scrollbars, body) lag behind the rest of the page.
  root.dataset.themeSwitching = "";
  root.dataset.theme = next;
  void root.offsetHeight; // apply the new colors before transitions come back
  requestAnimationFrame(() => {
    delete root.dataset.themeSwitching;
  });
  try {
    localStorage.setItem("theme", next);
  } catch {
    // Storage may be blocked; the theme still applies for this visit.
  }
  window.dispatchEvent(new Event("themechange"));
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  // null on the server, so the icon renders only after hydration
  const theme = useSyncExternalStore<Theme | null>(subscribe, getTheme, () => null);
  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={next === "dark" ? "다크 모드로 전환" : "라이트 모드로 전환"}
      className={`grid h-8 w-8 place-items-center border border-fg/20 text-fg transition hover:bg-fg/10 ${className}`}
    >
      {theme === "dark" ? (
        // Sun
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
        </svg>
      ) : theme === "light" ? (
        // Moon
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" strokeLinejoin="round" />
        </svg>
      ) : null}
    </button>
  );
}
