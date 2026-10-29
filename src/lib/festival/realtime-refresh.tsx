"use client";

// Refetches the page when festival data changes in another tab or for another user.
// It only invalidates; the page reloads its data from the server, where RLS applies.

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const TABLES = [
  "teams",
  "participants",
  "participant_private",
  "investments",
  "ticks",
  "demo_entries",
  "demo_assets",
] as const;

export function RealtimeRefresh({ channel }: { channel: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };
    const ch = supabase.channel(channel);
    for (const table of TABLES) ch.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    ch.subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [channel, router]);

  return null;
}
