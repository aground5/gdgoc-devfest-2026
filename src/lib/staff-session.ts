"use client";

// Staff login for /organize: Google sign-in through Supabase Auth, then the
// is_staff() RPC checks the email against the staff_emails whitelist.

import { useSyncExternalStore } from "react";
import { createClient } from "@/utils/supabase/client";

export type StaffSession =
  | { status: "loading" }
  | { status: "out" }
  | { status: "denied"; email: string } // signed in, but not on the whitelist
  | { status: "in"; email: string };

const LOADING: StaffSession = { status: "loading" };
const OUT: StaffSession = { status: "out" };

let supabase: ReturnType<typeof createClient> | null = null;
const client = () => (supabase ??= createClient());

let current: StaffSession = LOADING;
const listeners = new Set<() => void>();
let started = false;

function set(next: StaffSession) {
  current = next;
  listeners.forEach((l) => l());
}

async function load() {
  const sb = client();
  const { data } = await sb.auth.getClaims();
  const claims = data?.claims;
  // Anonymous participant sessions are not staff sessions
  if (!claims || claims.is_anonymous || !claims.email) return set(OUT);
  const { data: ok } = await sb.rpc("is_staff");
  set(ok ? { status: "in", email: claims.email } : { status: "denied", email: claims.email });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!started) {
    started = true;
    void load();
    client().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") set(OUT);
    });
  }
  return () => listeners.delete(cb);
}

export function useStaffSession(): StaffSession {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => LOADING,
  );
}

export async function signInWithGoogle() {
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/organize" + window.location.hash)}`;
  await client().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
}

export async function staffSignOut() {
  await client().auth.signOut();
  set(OUT);
}
