"use client";

// Participant login for /onfestival: an anonymous Supabase session that is
// bound to one participant row by name + access code (claim_participant RPC).
// Read with useParticipantSession(); the session survives reloads via cookies.

import { useSyncExternalStore } from "react";
import type { SchoolKey } from "@/data/guide";
import { createClient } from "@/utils/supabase/client";

export type SessionParticipant = {
  id: string;
  name: string;
  school: SchoolKey;
  team_id: string | null;
  checked_in: boolean;
};

export type ParticipantSession = { status: "loading" } | { status: "out" } | { status: "in"; participant: SessionParticipant };

const LOADING: ParticipantSession = { status: "loading" };
const OUT: ParticipantSession = { status: "out" };

let supabase: ReturnType<typeof createClient> | null = null;
const client = () => (supabase ??= createClient());

let current: ParticipantSession = LOADING;
const listeners = new Set<() => void>();
let started = false;

function set(next: ParticipantSession) {
  current = next;
  listeners.forEach((l) => l());
}

// Load the participant bound to the current auth user (RLS returns only that row)
async function load() {
  const sb = client();
  const { data: claims } = await sb.auth.getClaims();
  if (!claims) return set(OUT);
  const { data } = await sb.from("participants").select("id, name, school, team_id, checked_in").maybeSingle();
  set(data ? { status: "in", participant: data as SessionParticipant } : OUT);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!started) {
    started = true;
    void load();
    // Another tab logging in or out changes the shared cookies
    client().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") set(OUT);
    });
  }
  return () => listeners.delete(cb);
}

export function useParticipantSession(): ParticipantSession {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => LOADING,
  );
}

// Returns an error message, or null on success
export async function login(name: string, code: string): Promise<string | null> {
  const sb = client();
  const { data: claims } = await sb.auth.getClaims();
  if (!claims) {
    const { error } = await sb.auth.signInAnonymously();
    if (error) return "로그인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
  const { data, error } = await sb.rpc("claim_participant", { p_name: name, p_code: code });
  if (error) return "로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  const row = (data as SessionParticipant[] | null)?.[0];
  if (!row) return "이름 또는 참가자 코드가 맞지 않습니다.";
  set({ status: "in", participant: row });
  return null;
}

export async function logout() {
  const sb = client();
  await sb.rpc("release_participant");
  await sb.auth.signOut();
  set(OUT);
}
