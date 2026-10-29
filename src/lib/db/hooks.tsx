"use client";

// React Query layer over src/lib/db/queries.ts: cached reads, a `run()` helper
// for writes (refetch afterwards, show failures in a toast), and Supabase
// Realtime so edits by other staff show up without a reload.

import { QueryClient, QueryClientProvider, useQuery, type QueryKey } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import type { Participant, Team } from "@/data/guide";
import { createClient } from "@/utils/supabase/client";
import { DbError, fetchPeople, fetchTeams, fetchVenueCode, type Mode } from "./queries";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: true, retry: 1 } },
});

// Writes in flight; see refresh()
let pending = 0;

export const keys = {
  teams: ["teams"] as const,
  people: (mode: Mode) => ["people", mode] as const,
  venueCode: ["venue-code"] as const,
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
  queryClient.setQueriesData<Participant[]>({ queryKey: ["people"] }, (old) => old && fn(old));
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
      className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md border border-[var(--g-red)] bg-page px-4 py-3 text-sm font-semibold text-[var(--g-red)] shadow-lg"
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
