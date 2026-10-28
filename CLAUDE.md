# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page attendee guide for GDG DevFest 2026 (joint GDG on Campus event: Korea Univ., Yonsei, SKKU, KAIST). Next.js 16 App Router, React 19, Tailwind CSS v4, TypeScript. UI copy is Korean (`<html lang="ko">`). Deployed on Vercel (`.vercel/` is linked locally).

## Commands

```bash
npm run dev      # dev server at http://localhost:3000
npm run build    # production build (also type-checks)
npm run lint     # ESLint 9 flat config (next core-web-vitals + typescript)
npx tsc --noEmit # type-check only
```

There is no test framework set up.

## Architecture

- **Content lives in `src/data/guide.ts`.** Event info, notices, schedule, FAQs and venue details are plain typed arrays/objects there; components only render them. Many values are placeholders ("TBA", "추후 공지") to be replaced with confirmed details. Edit content here, not in components.
- **Tracks** (`공통`, `AI`, `Web`, `Mobile`, `Cloud`) are a union type in `guide.ts`; `trackColor` maps each to a CSS variable. Adding a track means updating `Track`, `tracks`, and `trackColor` together.
- **`src/app/page.tsx`** (`/`) is a server component: hero, at-a-glance summary, then `<GuideTabs />`, decorative stripes, footer.
- **`src/components/guide-tabs.tsx`** (client) holds all tab panels (overview, timetable, sessions, venue, FAQ) in one file. The active tab is stored in the URL hash (`#timetable` etc.) via `useSyncExternalStore` over `hashchange`; `goTo()` uses `history.replaceState` and dispatches a synthetic `hashchange`. Tabs follow the ARIA tablist pattern with arrow/Home/End keyboard handling.
- **`/onfestival`** (`src/app/onfestival/page.tsx` → `src/components/live-screen.tsx`, client) is the live (대회중) screen, reached from the "입장하기" link in the hero. It is a mockup with local state only, fed by the mock `teams` / `myTeamId` / `ATTENDANCE_CODE` / `INVEST_*` values in `guide.ts`. It has two tabs, 내 팀 (my team info, attendance check-in, team list) and 투자 (split a virtual budget across other teams' projects, then confirm).
  - This screen is for **an individual participant only**. Admin data (other teams' attendance, investment totals, etc.) must not appear here; it belongs in a separate admin view.
  - Members are assigned by staff: participants can edit their team's name, project and intro, but not its members. Teams can mix schools, so a school is stored per member (`Member.school`), not per team.
- **`src/components/brand.tsx`** has the school list (`schools`) and decorative SVG/stripe components (`GdgLogo`, `GoogleBar`, `LetterStripes`, `FoldStripes`).

## Theming

- Colors are CSS variables in `src/app/globals.css` (palette from the DevFest 2026 `.ase` file: school colors `--ku-*`, `--yu-*`, `--skku-*`, `--kaist-*` and Google colors `--g-*`), exposed to Tailwind via `@theme inline` as utilities like `bg-page`, `text-fg`, `bg-contrast`, `text-on-contrast`, `bg-raised`, `text-ku`, `bg-g-blue`. Use these semantic tokens rather than raw hex values.
- Dark mode follows `prefers-color-scheme` unless `data-theme="light"|"dark"` is set on `<html>`. Dark values are defined twice (media query and `[data-theme="dark"]`); keep both in sync.
- `ThemeToggle` persists the choice in `localStorage` (`theme`) and fires a `themechange` event. An inline script in `layout.tsx` applies the saved theme before first paint, so `<html>` uses `suppressHydrationWarning`.
- Client components that read browser state (`window`, hash, theme) use `useSyncExternalStore` with a server snapshot to avoid hydration mismatches; follow the same pattern.

## Conventions

- Import alias `@/*` → `src/*`.
- `.env*` files are gitignored; `.env.local` only holds a Vercel CLI token.
