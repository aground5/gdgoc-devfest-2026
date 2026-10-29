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

There are no JS tests. Database access rules are tested with pgTAP: `supabase start` (Docker), then `supabase test db`.

## Architecture

- **Content lives in `src/data/guide.ts`.** Event info, notices, the road-to-Demo-Day `steps`, the two-day `schedule` (`days`: 10/30 online OT, 11/6 Demo Day), team-building `keywords`, mock-investment rules, judging `criteria`, `awards`, FAQs and venue details are plain typed arrays/objects there; components only render them. Content comes from the organizer meetings; undecided items say "추후 공지". Edit content here, not in components. The event has no tracks (teams form around keywords), so don't reintroduce track filters.
- **`src/app/page.tsx`** (`/`) is a server component: hero (color bar + title + at-a-glance summary), then `<GuideTabs />`, footer.
- **`src/components/guide-tabs.tsx`** (client) holds all tab panels (개요, 타임테이블, 진행 방식, 오시는 길, FAQ) in one file. The active tab is stored in the URL hash (`#timetable` etc.) via `useSyncExternalStore` over `hashchange`; `goTo()` uses `history.replaceState` and dispatches a synthetic `hashchange`. Tabs follow the ARIA tablist pattern with arrow/Home/End keyboard handling.
- **Festival screens** — participants, teams, attendance and investments live in Supabase (see below) and are read/written from the browser through `src/lib/db/` (`queries.ts`: every Supabase call, mapped to the `Participant`/`Team` types; `hooks.tsx`: React Query hooks `usePeople(mode)`, `useTeams(mode)`, `useVenueCode()`, the `run(write)` helper that refetches and shows a failure toast, and `DbProvider` with a Realtime subscription; both pages wrap their screen in it). `FestivalState` (`src/lib/festival-store.ts`) is what the panels render: participants, teams, investments, budgets, ticks, `defaultBudget`, `step`, `investOpen`. Both screens build it with `buildState()` from the query hooks (`usePeople`, `useTeams`, `useInvestSettings`, `useInvestments`, `useTicks`, plus `useMyBudget` on `/onfestival`, since the directory has no budgets). `budgetOf()` falls back to `state.defaultBudget`. Derived values have selectors there too (`membersOf`, `budgetOf`, `investedBy`, `liveTotals`, `latestTick`, `won` for 원 formatting); reuse them instead of recomputing in components. There is no localStorage mock any more. Shared UI (frame with tabs, chips, field styles) is in `src/components/festival-ui.tsx`; its `useHashTab()` keeps the active tab in the URL hash (`/onfestival#invest`, `/organize#attendance`), like the main page.
  - **`/onfestival`** (`live-screen.tsx`) — participant view, reached from the hero's "입장하기" link. Tabs: 내 팀 (team info, own attendance via code, team list) and 투자 (split a virtual budget across other teams, confirm any number of times, plus 투자 현황: every published tick as a line chart with a ranking, in `investment-status.tsx`).
  - **데모 마켓** (a tab on both screens, `src/components/market/`): each team publishes its result for other teams to try. One `demo_entries` row per team; only its members edit it (`MarketEditor`). Publishing needs a live link, a description and test instructions (CHECK constraint). Optional: test account (`demo_entry_credentials`), screenshots and files. Uploads go from the browser to the private buckets `demo-images` / `demo-files` under `{team_id}/{entry_id}/…` (`uploadDemoAsset`), then a `demo_assets` row; reads use signed URLs. Participants see published, non-hidden entries; staff see all and hide (with a reason) or delete (`MarketModeration`). Rules shared with the DB limits are in `src/lib/market-rules.ts`.
  - **`/organize`** (`admin-screen.tsx`) — staff view: 참가자 (add/edit/delete, assign teams), 팀 (add/edit/delete, remove members), 일괄 수정 (`bulk-import.tsx` + `src/lib/bulk-import.ts`: download the current data as an .xlsx with sheets 팀/참가자 or as two CSVs, upload, preview, apply through RPC `bulk_import()` in one transaction; teams match by table label, participants by name + school (the file has no code column: new participants get a random code, existing ones keep theirs). Same-name people at the same school can't go through the file (error); staff handle them one by one in the 참가자 tab, without renaming, since login matches the name; uploading only one of the two leaves the other as is; optional "delete what's not in the file"), 출석 (per-person check-in, attendance code), 투자금 (each person's total budget, bulk-set for the filtered list, over-budget flag), 투자 현황 (publishing a new tick or deleting the latest one, the same published-tick chart participants see via `<PublishedStatus admin />`, then live totals and who invested). Staff-only (Google login + whitelist). The 투자금 tab also edits the default budget and the investment step (warning about amounts that no longer fit), and 투자 현황 opens and closes investing (`invest_settings.open`).
  - **Keep the roles separate.** The participant screen shows only that participant's own data plus public info. Admin data (others' attendance, live investment totals, who invested) stays on `/organize`. Participants see investment totals only through the ticks staff publish (`state.ticks`, each a `Snapshot`), never live; RLS enforces this (a participant's `investments` query returns only their own rows).
  - Members are assigned by staff: participants can edit their team's name, project and intro, but not its members. Teams can mix schools, so a school is stored per participant, and team members are derived from `Participant.teamId`. Attendance is per participant. Budgets: `state.budgets` holds only overrides; read with `budgetOf()` (default `INVEST_BUDGET`). If staff lower a budget below what someone already confirmed, that participant can't re-confirm until they cut back.
- **`src/components/brand.tsx`** has the school list (`schools`: `main` color and `on`, the text color that reads on it) and brand components: `ColorBar` (four labeled school bars over a black / white row, `square` or `wide`), `SchoolMark` (2×2 school-color mark), `SchoolBar` (thin four-school strip), `GdgLogo`.

## Design guide

`gdg-devfest-2026-sources/` holds the organizers' design guide (PDF), palette files and `color-bar.svg`. Follow it:
- **Colors: only the four schools' main colors (`--ku-main`, `--yu-main`, `--skku-main`, `--kaist-main`) plus the guide's black and white.** No tints, no Google colors, no other hex values; neutral shades are mixes of black and white.
- The core motif is the TV color bar, drawn with those colors only: four school bars (labeled with the school) over a black / white row. Don't copy `color-bar.svg` literally (its tints, strip and Google 4 colors are out). With body text next to it, keep the same margin on three sides of the bar. In tight spaces use the wide variation, but the school colors must always take the largest share. Don't use the letter/fold stripe ideas from the guide's "Unused Designs" appendix.
- Text-heavy screens use the "content-wise" look: a guide-black header bar (`.ink-bar`) with `SchoolMark`, the "GDG DevFest." wordmark and the `<>` logo.
- Layouts are asymmetric, flat and square (no rounded corners or shadows). One typeface, Regular (`font-normal`) and Bold (`font-bold`) only, no monospace; use `tabular-nums` for figures.
- Black and white are the guide's diluted `#181818` / `#E8E8E8`, not pure black/white.

## Theming

- Fonts: Google Sans (Latin) + Noto Sans KR (Hangul) via `next/font/google` in `layout.tsx`, loaded at 400/700 only.
- Colors are CSS variables in `src/app/globals.css`: the four school main colors, `--black` / `--white`, and theme tokens built from them, exposed to Tailwind via `@theme inline` as utilities like `bg-page`, `text-fg`, `bg-surface`, `bg-ku`, `bg-skku`, plus fixed `bg-ink` / `text-paper` (guide black/white in both themes). Use these tokens rather than raw hex values.
- Status uses the same palette through `--danger` (KU; white in dark mode), `--ok` (SKKU), `--warn` (KAIST) and `--accent` (YU; KAIST in dark mode, e.g. my team in the chart): `text-danger`, `border-ok`, `bg-warn`, `bg-accent`. KU/YU only read on light backgrounds and SKKU/KAIST on dark ones, so keep status text in `--fg` and use these colors for dots, borders and chips. A filled chip uses a fixed school color with `text-paper` (KU, YU) or `text-ink` (SKKU, KAIST).
- Dark mode follows `prefers-color-scheme` unless `data-theme="light"|"dark"` is set on `<html>`. Dark values are defined twice (media query and `[data-theme="dark"]`); keep both in sync.
- `ThemeToggle` persists the choice in `localStorage` (`theme`) and fires a `themechange` event. An inline script in `layout.tsx` applies the saved theme before first paint, so `<html>` uses `suppressHydrationWarning`.
- Client components that read browser state (`window`, hash, theme) use `useSyncExternalStore` with a server snapshot to avoid hydration mismatches; follow the same pattern.

## Conventions

- Import alias `@/*` → `src/*`.
- Participants mostly use phones; check pages at 390px wide. Form fields keep 16px text (`fieldCls`; iOS zooms into smaller fields). Body text uses `word-break: keep-all` so Korean wraps between words, with `overflow-wrap: break-word` (not `anywhere`, which squeezes short labels). Fixed bottom bars pad with `env(safe-area-inset-bottom)` (`viewport-fit=cover` in `layout.tsx`), like the invest tab's confirm bar.
- `.env*` files are gitignored; `.env.local` holds a Vercel CLI token plus `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Supabase

- Clients via `@supabase/ssr` in `src/utils/supabase/`: `client.ts` (Client Components), `server.ts` (`createClient(await cookies())` in Server Components/Actions/Route Handlers), `middleware.ts` (`updateSession`).
- `src/proxy.ts` (Next 16's renamed middleware) calls `updateSession` on every non-static request to refresh the auth cookies. Don't add code between `createServerClient` and `auth.getClaims()` there.
- CLI is linked to project `gdg-devfest-2026` (`fiotlwpevozdaulqaifx`); schema changes go in `supabase/migrations/` and are applied with `supabase db push`.
- `public.participants` (name, school, team_id, unique `access_code`, `user_id` → auth.users). Codes are 6 chars without look-alikes (`generate_access_code()`).
- `public.teams` (name, `table_label`, project, description); `participants.team_id` → teams (on delete set null).
- `public.attendance` (participant_id, `day` in Asia/Seoul, method `code`|`staff`, checked_by; unique per participant per day) replaces the old `checked_in` flag. `attendance_settings` is a single row with the venue code (null = closed). Participants check in only via RPC `check_in(p_code)`. Wrong codes are logged in `check_in_attempts` (no client access); after 5 within 10 minutes it raises hint `rate_limited`.
- Staff: Google sign-in (Supabase Auth) + whitelist `public.staff_emails` (email, note, `added_by`). Any staff member manages it in the `/organize` 운영진 tab (`StaffPanel`): add, edit notes, remove. The delete policy refuses removing your own email (`email <> my_email()`), and the email column is never updatable, so nobody can lock themselves out. `is_staff()` = Google provider and whitelisted email. Staff policies allow full CRUD on participants, teams and attendance, and read/update of attendance_settings. `/organize` is gated by `src/lib/staff-session.ts`; OAuth returns to `src/app/auth/callback/route.ts`.
- Team members edit their team only via RPC `update_my_team(p_name, p_project, p_description)`.
- Access (`rls_policies` migration, extended by `staff_auth`/`attendance`): `anon` has no table privileges. `authenticated` (a logged-in participant) reads its own participant row, all teams, and other participants only via RPC `participant_directory()` (id, name, school, team_id: no codes or attendance); sees only its own attendance. Participants have no direct insert/update/delete on any table.
- Investment tables (`investments` migration; both screens use them):
  - `invest_settings`: a single row holding `default_budget`, `step` and `open`.
  - `participants.invest_budget`: a per-person override; null means the default budget.
  - `investments`: the current allocation, one row per participant and team.
  - `investment_confirmations`: every confirmation, storing the whole allocation as jsonb with the total and the budget at that moment.
  - `invest_ticks`: published ticks.
  - `invest_tick_totals`: team totals for each tick; this is what participants see.
  - `invest_tick_allocations`: each person's allocation at each tick; staff only.
- Investment rules:
  - Participants confirm only through RPC `confirm_investments(p_alloc jsonb)`. It replaces the caller's whole allocation and logs a confirmation. It enforces that investing is open, amounts are multiples of `step`, there's no investment in the caller's own team, and the sum fits the budget. Errors carry `hint`: `closed`, `step`, `own_team` or `over_budget`.
  - Staff publish through RPC `publish_tick()`, which records totals and per-person allocations in one transaction. Staff delete ticks directly.
  - A trigger drops a participant's investment in the team they're moved into.
- `bulk_import(p_teams, p_people, p_delete_missing)` is staff-only, serialized by an advisory lock, and validates everything again on the server. Errors carry hints (`dup_table`, `dup_person`, `ambiguous_person`, `team_required`, `person_required`, `bad_school`, `bad_table`).
- `is_participant()` is true only for a user bound to a participant row. The investment policies use it so an unbound anonymous session sees nothing. The older teams and directory rules don't use it yet.
- Tables `participants`, `teams`, `attendance`, `attendance_settings`, `invest_settings`, `investments`, `invest_ticks`, `invest_tick_totals`, `staff_emails` are in the `supabase_realtime` publication. Participants only get events for rows RLS lets them see, so their screen also polls every 30s.
- Regenerate `src/lib/db/types.ts` after schema changes: `supabase gen types typescript --linked --schema public > src/lib/db/types.ts`.
- **Write pattern (follow it for every Supabase write):** call `run(write, optimistic)` from `src/lib/db/hooks.tsx`, with the request from `queries.ts` and a cache patch from `patch` (`person`, `removePerson`, `attendance`, `team`, `removeTeam`, `venueCode`; add one when a new write needs it).
  - `run` cancels in-flight queries, applies the patch so the UI changes at once, then sends the write. On failure it restores the cache and shows the error toast. Don't wait for a refetch to update the screen: a controlled input bound to query data would snap back to the old value, which is the flicker this pattern fixes.
  - While any write is in flight, refetches are held back: Realtime events, post-write invalidation and polling (`poll()`). This keeps a refetch between two quick edits from showing the server state without the second edit. After the last write settles, everything is refetched once. Route new refetch triggers through `refresh()`, never call `invalidateQueries` directly.
  - **Free-text fields that save as you type** (e.g. the staff note, `StaffNote` in `admin-screen.tsx`) debounce instead of writing on every keystroke:
    - Keep a local `draft`, and render `draft ?? serverValue`.
    - On change, restart a timer (`NOTE_DEBOUNCE`, 600 ms). Flush right away on blur and Enter; Escape cancels the timer and drops the draft.
    - Saving goes through `run()` with an optimistic patch, like any other write. Skip the write if the trimmed value equals the server value.
    - After the save, clear the draft only if it still equals the saved value (`setDraft((d) => (d === value ? null : d))`). Otherwise typing that continued while the request was in flight would be wiped.
    - Clear the timer on unmount.
  - Writes whose result the server decides (insert with a generated id or code, `check_in`) skip `optimistic`. Show the result after `run` returns, and patch the cache then if needed (see `AttendanceCard`).
- Demo Market tables (`demo_market` migration): `demo_entries`, `demo_entry_credentials`, `demo_assets`, storage buckets `demo-images` / `demo-files`. `my_team_id()` is the caller's team. Members write only their own team's rows and storage folder; a trigger keeps `hidden` / `hidden_reason` / `team_id` staff-only. Reading requires `is_participant()` (or own team / staff), so an unbound anonymous session sees nothing.
- Database tests: pgTAP files in `supabase/tests/database/`, run against the local stack with `supabase test db` (they use the seed and roll back). Add one for every new access rule.
- `supabase/seed.sql` holds the sample teams/participants (originally the guide.ts mock) with fixed test access codes (applied with `supabase db push --include-seed`; it skips if teams has rows). Replace before the real event.
- Participant login (`src/lib/participant-session.ts`): sign in anonymously, then RPC `claim_participant(p_name, p_code)` matches name + code and binds the row to `auth.uid()`; `release_participant()` on logout. `/onfestival` is gated by it. Behind the gates, everything comes from Supabase.
