# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An attendee guide plus the event-day app for GDG DevFest 2026 (joint GDG on Campus event: Korea Univ., Yonsei, SKKU, KAIST). Next.js 16 App Router, React 19, Tailwind CSS v4, TypeScript, Supabase (Postgres + Auth + Storage). UI copy is Korean (`<html lang="ko">`). Deployed on Vercel (`.vercel/` is gitignored; link with `vercel link` if missing).

## Commands

```bash
npm run dev      # dev server at http://localhost:3000
npm run build    # production build (also type-checks)
npm run lint     # ESLint 9 flat config (next core-web-vitals + typescript)
npx tsc --noEmit # type-check only

supabase start   # local Supabase in Docker (applies supabase/migrations + seed.sql); Mailpit at :54324
npm run db:reset # re-apply migrations + seed
npm run db:test  # pgTAP tests in supabase/tests/database (role/RLS rules)
npm run db:types # regenerate src/lib/database.types.ts after changing the schema
```

`.env.local` needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` (see `.env.example`; local values come from `supabase status`). There are no JS tests; the database rules are tested with pgTAP.

## Architecture

- **Content lives in `src/data/guide.ts`.** Event info, notices, the road-to-Demo-Day `steps`, the two-day `schedule` (`days`: 10/30 online OT, 11/6 Demo Day), team-building `keywords`, mock-investment rules, judging `criteria`, `awards`, FAQs and venue details are plain typed arrays/objects there; components only render them. Content comes from the organizer meetings; undecided items say "추후 공지". Edit content here, not in components. The event has no tracks (teams form around keywords), so don't reintroduce track filters.
- **`src/app/page.tsx`** (`/`) is a server component: hero (color bar + title + at-a-glance summary), then `<GuideTabs />`, footer.
- **`src/components/guide-tabs.tsx`** (client) holds all tab panels (개요, 타임테이블, 진행 방식, 오시는 길, FAQ) in one file. The active tab is stored in the URL hash (`#timetable` etc.) via `useSyncExternalStore` over `hashchange`; `goTo()` uses `history.replaceState` and dispatches a synthetic `hashchange`. Tabs follow the ARIA tablist pattern with arrow/Home/End keyboard handling.
- **Festival app (Supabase)** — `/onfestival` (participants) and `/organize` (staff). The database enforces every rule (RLS, triggers, RPCs in `supabase/migrations/`); the UI only mirrors them.
  - **Reads:** the route `page.tsx` files are async Server Components. They call `requireViewer()` (`src/lib/auth.ts`), then `loadFestival()` / `loadStaffExtras()` (`src/lib/festival/load.ts`) and `loadMarket()` (`src/lib/festival/market.ts`), and pass `FestivalState` (`src/lib/festival/types.ts`) to the client screens. RLS decides what comes back: a participant gets their own private row and investments, staff get everything. Pure selectors (`membersOf`, `budgetOf`, `investedBy`, `liveTotals`, `latestTick`, `won`) are in `src/lib/festival/selectors.ts`.
  - **Writes:** Server Actions in `src/app/onfestival/actions.ts`, `src/app/organize/actions.ts` and `src/app/onfestival/market/actions.ts` run as the signed-in user (`src/lib/supabase/server.ts`), call a table write or an RPC, then `refresh()`. They return `ActionResult`; RPC errors carry a code in `HINT` that `fail()` (`src/lib/festival/result.ts`) maps to Korean copy. `<RealtimeRefresh>` refetches the page when another user changes data.
  - **Sign-in:** participants use a staff-issued code `LLLL-SSSS-SSSS` (`src/lib/festival/login-code.ts`): the login id names an auth user `<id>@participants.devfest.invalid`, and the secret is its password. Staff issue or reissue codes on /organize (`issueCodes`, which uses the secret-key admin client `src/lib/supabase/admin.ts`, server only). Codes are shown once and never stored readably. Staff sign in with a whitelisted email (`public.staff`) by magic link or 6-digit code. The auth hook `hook_before_user_created` rejects everyone else, and triggers link auth users to rows. `src/proxy.ts` refreshes the session.
  - **Keep the roles separate.** Participants never receive others' attendance, live totals, the attendance code (checked by the `check_in` RPC), or who invested. They see totals only through ticks staff publish (`publish_tick`). Investing goes through `confirm_investments`, which atomically replaces the allocation and rejects investing in your own team, off-step amounts and going over budget. If staff lower a budget below what someone already confirmed, that participant can't re-confirm until they cut back. Members can edit their team's name, project and description (a trigger keeps `table_no` staff-only), but not membership.
  - **Demo Market** (데모 마켓 tab on both screens, `src/components/market/`): one `demo_entries` row per team. Only members edit it. Publishing requires a live link, a description and test instructions (a CHECK constraint). Test credentials live in `demo_entry_credentials`. Images and files are uploaded from the browser to private buckets `demo-images` / `demo-files` under `{team_id}/{entry_id}/…` (storage policies allow only your own team's prefix) and are served by signed URLs. Staff can hide (with a reason) or delete entries. Peer evaluation isn't built yet; a future table would reference `demo_entries.id`.
  - Shared UI (frame with tabs, chips, field styles) is in `src/components/festival-ui.tsx`; `useHashTab()` keeps the active tab in the URL hash (`/onfestival#invest`, `/organize#attendance`). `supabase/seed.sql` holds local sample data (staff `staff@devfest.test`, 28 participants with login ids but no codes; issue them on /organize).
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
- `.env*` files are gitignored except `.env.example`. Never expose `SUPABASE_SECRET_KEY` to client code; `src/lib/supabase/admin.ts` is `server-only`.
- Schema changes go in a new file in `supabase/migrations/`, followed by `npm run db:types` and a pgTAP test for any new rule. Functions are `security definer` with `search_path = ''` and fully qualified names, and `execute` is revoked from `anon`. Supabase grants new functions to `anon` by default, so revoke it in the migration.
