"use client";

// Page transition: when a link takes you to another page of this site, four
// columns in the schools' colors drop down one after another to cover the
// screen; once the new page has rendered they rise again in the same order.
// Only for page changes (not tab switches via #hash, not every action), and
// skipped when the user prefers reduced motion.

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { schools } from "./brand";

const DURATION = 380; // ms per column
const STAGGER = 60; // ms between columns
const COVERED_AFTER = DURATION + STAGGER * (schools.length - 1);
// If the new page doesn't arrive (same URL, error), uncover anyway
const GIVE_UP_AFTER = 4000;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// A plain left click on a same-origin link to a different page
function pageLinkTarget(e: MouseEvent): URL | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.("a[href]");
  if (!(a instanceof HTMLAnchorElement)) return null;
  if ((a.target && a.target !== "_self") || a.hasAttribute("download") || a.dataset.noTransition !== undefined) return null;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return null;
  if (url.pathname === location.pathname) return null; // same page (e.g. only the #hash changes)
  return url;
}

export function PageTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const [covered, setCovered] = useState(false);
  const pending = useRef<{ from: string; timer?: ReturnType<typeof setTimeout> } | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const url = pageLinkTarget(e);
      if (!url || reducedMotion() || pending.current) return;
      // Captured before React sees the click; next/link skips prevented clicks
      e.preventDefault();
      const from = location.pathname;
      pending.current = { from };
      setCovered(true);
      setTimeout(() => {
        router.push(url.pathname + url.search + url.hash);
        pending.current!.timer = setTimeout(() => {
          pending.current = null;
          setCovered(false);
        }, GIVE_UP_AFTER);
      }, COVERED_AFTER);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  // The new page is in: rise again once it has painted
  useEffect(() => {
    const p = pending.current;
    if (!p || pathname === p.from) return;
    clearTimeout(p.timer);
    pending.current = null;
    // Not cancelled on cleanup: React's dev double-run would otherwise leave the screen covered
    requestAnimationFrame(() => requestAnimationFrame(() => setCovered(false)));
  }, [pathname]);

  return (
    // While covered it also swallows clicks, so nothing underneath is pressed mid-transition
    <div data-page-transition aria-hidden="true" className={`fixed inset-0 z-[100] flex overflow-hidden ${covered ? "" : "pointer-events-none"}`}>
      {schools.map((s, i) => (
        <div
          key={s.key}
          className="h-full flex-1 will-change-transform"
          style={{
            background: s.main,
            transform: covered ? "translateY(0)" : "translateY(-100%)",
            transition: `transform ${DURATION}ms cubic-bezier(0.7, 0, 0.3, 1) ${i * STAGGER}ms`,
          }}
        />
      ))}
    </div>
  );
}
