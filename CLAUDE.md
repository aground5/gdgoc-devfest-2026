# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page attendee guide for GDG DevFest 2026 (joint GDG on Campus event: Korea Univ., Yonsei, SKKU, KAIST). Next.js 16 App Router, React 19, Tailwind CSS v4, TypeScript. UI copy is Korean (`<html lang="ko">`). Deployed on Vercel (`.vercel/` is gitignored; link with `vercel link` if missing).

## Commands

```bash
npm run dev      # dev server at http://localhost:3000
npm run build    # production build (also type-checks)
npm run lint     # ESLint 9 flat config (next core-web-vitals + typescript)
npx tsc --noEmit # type-check only
```

There is no test framework set up.

## Architecture

- **Content lives in `src/data/guide.ts`.** Event info, notices, the road-to-Demo-Day `steps`, the two-day `schedule` (`days`: 10/30 online OT, 11/6 Demo Day), team-building `keywords`, mock-investment rules, judging `criteria`, `awards`, FAQs and venue details are plain typed arrays/objects there; components only render them. Content comes from the organizer meetings; undecided items say "추후 공지". Edit content here, not in components. The event has no tracks (teams form around keywords), so don't reintroduce track filters.
- **`src/app/page.tsx`** (`/`) is a server component: hero (color bar + title + at-a-glance summary), then `<GuideTabs />`, footer.
- **`src/components/guide-tabs.tsx`** (client) holds all tab panels (개요, 타임테이블, 진행 방식, 오시는 길, FAQ) in one file. The active tab is stored in the URL hash (`#timetable` etc.) via `useSyncExternalStore` over `hashchange`; `goTo()` uses `history.replaceState` and dispatches a synthetic `hashchange`. Tabs follow the ARIA tablist pattern with arrow/Home/End keyboard handling.
- **Festival mockup** — two client screens sharing one mock backend, `src/lib/festival-store.ts`: state (participants, teams, confirmed investments, per-person budgets, published ticks, attendance code) is kept in `localStorage` and read with `useSyncExternalStore` via `useFestival()`; write with `updateFestival(fn)`. Derived values have selectors there too (`membersOf`, `budgetOf`, `investedBy`, `liveTotals`, `latestTick`, `won` for 원 formatting); reuse them instead of recomputing in components. Changes sync across pages and tabs. Seed data (`seedParticipants`, `seedTeams`, `myParticipantId`, `seedAttendanceCode`, `INVEST_*`) is in `guide.ts`. Shared UI (frame with tabs, chips, field styles) is in `src/components/festival-ui.tsx`; its `useHashTab()` keeps the active tab in the URL hash (`/onfestival#invest`, `/organize#attendance`), like the main page.
  - **`/onfestival`** (`live-screen.tsx`) — participant view, reached from the hero's "입장하기" link. Tabs: 내 팀 (team info, own attendance via code, team list) and 투자 (split a virtual budget across other teams, confirm any number of times, plus 투자 현황: every published tick as a line chart with a ranking, in `investment-status.tsx`).
  - **`/organize`** (`admin-screen.tsx`) — staff view: 참가자 (add/edit/delete, assign teams), 팀 (add/edit/delete, remove members), 출석 (per-person check-in, attendance code), 투자금 (each person's total budget, bulk-set for the filtered list, over-budget flag), 투자 현황 (publishing a new tick or deleting the latest one, the same published-tick chart participants see via `<PublishedStatus admin />`, then live totals and who invested). There is no auth; it's a mockup.
  - **Keep the roles separate.** The participant screen shows only that participant's own data plus public info. Admin data (others' attendance, live investment totals, who invested) stays on `/organize`. Participants see investment totals only through the ticks staff publish (`state.ticks`, each a `Snapshot`), never live. The localStorage key is versioned (`devfest-festival-mock-vN`); bump it when the state shape changes.
  - Members are assigned by staff: participants can edit their team's name, project and intro, but not its members. Teams can mix schools, so a school is stored per participant, and team members are derived from `Participant.teamId`. Attendance is per participant. Budgets: `state.budgets` holds only overrides; read with `budgetOf()` (default `INVEST_BUDGET`). If staff lower a budget below what someone already confirmed, that participant can't re-confirm until they cut back.
- **`src/components/brand.tsx`** has the school list (`schools`) and brand components: `ColorBar` (the guide's TV color bar, `square` or `wide`), `SchoolMark` (2×4 school-color mark), `GoogleBar`, `GdgLogo`.

## Design guide

`gdg-devfest-2026-sources/` holds the organizers' design guide (PDF), palette files and `color-bar.svg`. Follow it:
- The core motif is the TV color bar: school pairs (darker tone left) with a strip underneath, then black / white / Google 4 colors. With body text next to it, keep the same margin on three sides of the bar. In tight spaces use the wide variation, but the school colors must always take the largest share. Don't use the letter/fold stripe ideas from the guide's "Unused Designs" appendix.
- Text-heavy screens use the "content-wise" look: a guide-black header bar (`.ink-bar`) with `SchoolMark`, the "GDG DevFest." wordmark and the `<>` logo.
- Layouts are asymmetric, flat and square (no rounded corners or shadows). One typeface, Regular (`font-normal`) and Bold (`font-bold`) only, no monospace; use `tabular-nums` for figures.
- Black and white are the guide's diluted `#181818` / `#E8E8E8`, not pure black/white.

## Theming

- Fonts: Google Sans (Latin) + Noto Sans KR (Hangul) via `next/font/google` in `layout.tsx`, loaded at 400/700 only.
- Colors are CSS variables in `src/app/globals.css` (palette from the DevFest 2026 `.ase` file: school colors `--ku-*`, `--yu-*`, `--skku-*`, `--kaist-*` and Google colors `--g-*`), exposed to Tailwind via `@theme inline` as utilities like `bg-page`, `text-fg`, `bg-contrast`, `text-on-contrast`, `bg-raised`, `text-ku`, `bg-g-blue`, plus fixed `bg-ink` / `text-paper` (guide black/white in both themes). Use these semantic tokens rather than raw hex values.
- Dark mode follows `prefers-color-scheme` unless `data-theme="light"|"dark"` is set on `<html>`. Dark values are defined twice (media query and `[data-theme="dark"]`); keep both in sync.
- `ThemeToggle` persists the choice in `localStorage` (`theme`) and fires a `themechange` event. An inline script in `layout.tsx` applies the saved theme before first paint, so `<html>` uses `suppressHydrationWarning`.
- Client components that read browser state (`window`, hash, theme) use `useSyncExternalStore` with a server snapshot to avoid hydration mismatches; follow the same pattern.

## Conventions

- Import alias `@/*` → `src/*`.
- `.env*` files are gitignored; the app reads no env vars (a local `.env.local`, if present, only holds a Vercel CLI token).
