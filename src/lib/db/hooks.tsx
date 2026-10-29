"use client";

// React Query layer over src/lib/db/queries.ts: cached reads, a `run()` helper
// for writes (refetch afterwards, show failures in a toast), and Supabase
// Realtime so edits by other staff show up without a reload.

import { QueryClient, QueryClientProvider, useQuery, type QueryKey } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import type { ContentKey, Participant, SiteContent, Team } from "@/data/guide";
import { createClient } from "@/utils/supabase/client";
import type { Investments, Snapshot } from "@/lib/festival-store";
import {
  DbError,
  fetchInvestSettings,
  fetchInvestments,
  fetchMyBudget,
  fetchPeople,
  fetchTeams,
  fetchTicks,
  fetchSiteContent,
  fetchStaffEmails,
  fetchVenueCode,
  type InvestSettings,
  type StaffEmail,
  type Mode,
} from "./queries";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: true, retry: 1 } },
});

// Writes in flight; see refresh()
let pending = 0;

export const keys = {
  teams: ["teams"] as const,
  people: (mode: Mode) => ["people", mode] as const,
  venueCode: ["venue-code"] as const,
  investSettings: ["invest", "settings"] as const,
  investments: ["invest", "allocations"] as const,
  ticks: ["invest", "ticks"] as const,
  staffEmails: ["staff-emails"] as const,
  siteContent: ["site-content"] as const,
  // Under "people" so participant-row changes refetch it
  myBudget: (id: string) => ["people", "my-budget", id] as const,
};

// Participants can't receive change events for other people's rows (RLS),
// so their screen also polls.
const POLL = { staff: false, participant: 30_000 } as const;
// Skip a scheduled poll while a write is in flight (see `pending` below)
const poll = (mode: Mode) => () => (pending > 0 ? false : POLL[mode]);

export const useTeams = (mode: Mode) => useQuery({ queryKey: keys.teams, queryFn: fetchTeams, refetchInterval: poll(mode) });

export const usePeople = (mode: Mode) =>
  useQuery({ queryKey: keys.people(mode), queryFn: () => fetchPeople(mode), refetchInterval: poll(mode) });

export const useVenueCode = () => useQuery({ queryKey: keys.venueCode, queryFn: fetchVenueCode });

export const useInvestSettings = (mode: Mode) =>
  useQuery({ queryKey: keys.investSettings, queryFn: fetchInvestSettings, refetchInterval: poll(mode) });
export const useInvestments = (mode: Mode) =>
  useQuery({ queryKey: keys.investments, queryFn: fetchInvestments, refetchInterval: poll(mode) });
export const useTicks = (mode: Mode) => useQuery({ queryKey: keys.ticks, queryFn: fetchTicks, refetchInterval: poll(mode) });
export const useSiteContent = () => useQuery({ queryKey: keys.siteContent, queryFn: fetchSiteContent });
export const useStaffEmails = () => useQuery({ queryKey: keys.staffEmails, queryFn: fetchStaffEmails });
export const useMyBudget = (id: string) =>
  useQuery({ queryKey: keys.myBudget(id), queryFn: () => fetchMyBudget(id), refetchInterval: poll("participant") });

/* ---------- Writes ---------- */

// Writes in flight. While any is pending, refetches (after a write, or from a
// Realtime event) are held back: a refetch that lands between two quick edits
// would return the server state without the second edit and flip the screen
// back. Once the last write settles, everything is refetched once.

function refresh(queryKey?: QueryKey) {
  if (pending > 0) return; // run() refetches everything once the last write settles
  void queryClient.invalidateQueries(queryKey ? { queryKey } : undefined);
}

// Runs a write. `optimistic` patches the cache first so the screen changes
// right away (a controlled <select> would otherwise snap back to the old value
// until the refetch lands); on failure the cache is rolled back. Returns false
// and shows the error toast if the write failed.
export async function run(write: () => Promise<unknown>, optimistic?: () => void): Promise<boolean> {
  pending++;
  let snapshot: [QueryKey, unknown][] = [];
  try {
    if (optimistic) {
      // Stop in-flight refetches so they can't overwrite the optimistic state
      await queryClient.cancelQueries();
      snapshot = queryClient.getQueriesData({});
      optimistic();
    }
    await write();
    return true;
  } catch (e) {
    for (const [key, data] of snapshot) queryClient.setQueryData(key, data);
    showToast(e instanceof DbError ? e.message : "네트워크 오류로 저장하지 못했습니다.");
    return false;
  } finally {
    pending--;
    if (pending === 0) refresh();
  }
}

// Cache patches for run(..., optimistic)
const mapPeople = (fn: (list: Participant[]) => Participant[]) => () =>
  // Only the people lists; ["people", "my-budget", id] holds a number
  queryClient.setQueriesData<unknown>({ queryKey: ["people"] }, (old: unknown) => (Array.isArray(old) ? fn(old as Participant[]) : old));
const mapTeams = (fn: (list: Team[]) => Team[]) => () => queryClient.setQueryData<Team[]>(keys.teams, (old) => old && fn(old));

export const patch = {
  person: (id: string, p: Partial<Participant>) => mapPeople((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x))),
  removePerson: (id: string) => mapPeople((l) => l.filter((x) => x.id !== id)),
  attendance: (ids: string[], on: boolean) => mapPeople((l) => l.map((x) => (ids.includes(x.id) ? { ...x, checkedIn: on } : x))),
  team: (id: string, t: Partial<Team>) => mapTeams((l) => l.map((x) => (x.id === id ? { ...x, ...t } : x))),
  removeTeam: (id: string) => () => {
    mapTeams((l) => l.filter((x) => x.id !== id))();
    mapPeople((l) => l.map((x) => (x.teamId === id ? { ...x, teamId: null } : x)))();
  },
  venueCode: (code: string | null) => () => queryClient.setQueryData(keys.venueCode, code),
  budgets: (ids: string[], budget: number | null) => mapPeople((l) => l.map((x) => (ids.includes(x.id) ? { ...x, budget } : x))),
  investSettings: (p: Partial<InvestSettings>) => () =>
    queryClient.setQueryData<InvestSettings>(keys.investSettings, (old) => old && { ...old, ...p }),
  myInvestments: (pid: string, alloc: Record<string, number>) => () =>
    queryClient.setQueryData<Investments>(keys.investments, (old) => old && { ...old, [pid]: alloc }),
  siteContent: (key: ContentKey, value: unknown) => () =>
    queryClient.setQueryData<SiteContent>(keys.siteContent, (old) => old && { ...old, [key]: value }),
  staffNote: (email: string, note: string) => () =>
    queryClient.setQueryData<StaffEmail[]>(keys.staffEmails, (old) => old?.map((x) => (x.email === email ? { ...x, note } : x))),
  removeStaffEmail: (email: string) => () =>
    queryClient.setQueryData<StaffEmail[]>(keys.staffEmails, (old) => old?.filter((x) => x.email !== email)),
  removeTick: (id: number) => () => queryClient.setQueryData<Snapshot[]>(keys.ticks, (old) => old?.filter((t) => t.id !== id)),
};

/* ---------- Error toast ---------- */

let toast: { id: number; text: string } | null = null;
const toastListeners = new Set<() => void>();

function showToast(text: string) {
  const id = Date.now();
  toast = { id, text };
  toastListeners.forEach((l) => l());
  setTimeout(() => {
    if (toast?.id !== id) return;
    toast = null;
    toastListeners.forEach((l) => l());
  }, 5000);
}

function subscribeToast(cb: () => void) {
  toastListeners.add(cb);
  return () => toastListeners.delete(cb);
}

function Toast() {
  const t = useSyncExternalStore(
    subscribeToast,
    () => toast,
    () => null,
  );
  if (!t) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md border border-[var(--g-red)] bg-page px-4 py-3 text-sm font-bold text-[var(--g-red)]"
    >
      {t.text}
    </div>
  );
}

/* ---------- Provider ---------- */

const TABLE_KEYS = {
  participants: ["people"],
  teams: keys.teams,
  attendance: ["people"],
  attendance_settings: keys.venueCode,
  invest_settings: keys.investSettings,
  investments: keys.investments,
  invest_ticks: keys.ticks,
  invest_tick_totals: keys.ticks,
  staff_emails: keys.staffEmails,
  site_content: keys.siteContent,
} as const;

function useRealtime() {
  useEffect(() => {
    const sb = createClient();
    let channel = sb.channel("db-changes");
    for (const [table, key] of Object.entries(TABLE_KEYS)) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, () => refresh(key));
    }
    channel.subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, []);
}

export function DbProvider({ children }: { children: ReactNode }) {
  useRealtime();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toast />
    </QueryClientProvider>
  );
}
