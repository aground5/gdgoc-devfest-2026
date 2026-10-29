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

// A little depth on each column, from the site's original folded stripes (FoldStripes):
// the column reads as a sheet creased down the middle (left half in shade), with a
// diagonal fold at its end, alternating bottom/top; the second column also has the
// sawtooth notch. Drawn with translucent guide black/white over the school color,
// so the palette stays the four main colors plus black and white.
const SHADE = "color-mix(in srgb, var(--black) 14%, transparent)";
const FOLD = "color-mix(in srgb, var(--black) 24%, transparent)";
const LIGHT = "color-mix(in srgb, var(--white) 18%, transparent)";

function Folds({ index }: { index: number }) {
  const bottom = index % 2 === 0;
  return (
    <>
      <span className="absolute inset-y-0 left-0 w-1/2" style={{ background: SHADE }} />
      <span
        className="absolute inset-x-0 h-1/3"
        style={{
          [bottom ? "bottom" : "top"]: 0,
          background: FOLD,
          clipPath: bottom ? "polygon(0 100%, 100% 0, 100% 100%)" : "polygon(0 0, 100% 0, 0 100%)",
        }}
      />
      {index === 1 && (
        <span
          className="absolute right-1/2 top-1/4 h-1/2 w-1/4"
          style={{
            background: LIGHT,
            clipPath: "polygon(100% 0, 0 16.6%, 100% 33.3%, 0 50%, 100% 66.6%, 0 83.3%, 100% 100%)",
          }}
        />
      )}
    </>
  );
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
          className="relative h-full flex-1 overflow-hidden will-change-transform"
          style={{
            background: s.main,
            transform: covered ? "translateY(0)" : "translateY(-100%)",
            transition: `transform ${DURATION}ms cubic-bezier(0.7, 0, 0.3, 1) ${i * STAGGER}ms`,
          }}
        >
          <Folds index={i} />
        </div>
      ))}
    </div>
  );
}
