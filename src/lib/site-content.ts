// Guide page content: Supabase rows merged over the guide.ts defaults. Works on
// the server (the public page) and in the browser (the staff editor).

import { createClient } from "@supabase/supabase-js";
import { defaultContent, type ContentKey, type SiteContent } from "@/data/guide";
import type { Database } from "@/lib/db/types";

export function mergeContent(rows: { key: string; value: unknown }[] | null | undefined): SiteContent {
  const out = { ...defaultContent } as SiteContent;
  for (const r of rows ?? []) {
    if (r.key in out) (out as Record<string, unknown>)[r.key] = r.value;
  }
  return out;
}

// Server read for the public page. Any failure falls back to the defaults so
// the guide never breaks.
export async function getSiteContent(): Promise<SiteContent> {
  try {
    const sb = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data, error } = await sb.from("site_content").select("key, value");
    if (error) throw error;
    return mergeContent(data);
  } catch {
    return { ...defaultContent } as SiteContent;
  }
}

export type { ContentKey, SiteContent };
