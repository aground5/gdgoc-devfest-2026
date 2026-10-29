"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { participantEmail, parseCode } from "@/lib/festival/login-code";

// Only paths on this site, so `next` can't be turned into an open redirect.
const safeNext = (next: string) => (next.startsWith("/") && !next.startsWith("//") ? next : "/onfestival");

// Participants: the staff-issued code is the whole credential (login id + secret).
export async function signInWithCode(_: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const next = safeNext(String(form.get("next") ?? ""));
  const parsed = parseCode(String(form.get("code") ?? ""));
  if (!parsed) return { error: "코드 12자리를 정확히 입력해 주세요. (예: AB2C-3DEF-4GHJ)" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: participantEmail(parsed.loginId),
    password: parsed.secret,
  });
  if (error) {
    if (error.status === 429) return { error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." };
    return { error: "코드가 맞지 않습니다. 운영진에게 확인해 주세요." };
  }
  redirect(next);
}

// Staff: Google sign-in. Only emails on the staff whitelist get through (auth hook).
export async function signInWithGoogle(form: FormData) {
  const next = safeNext(String(form.get("next") ?? "/organize"));
  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect(`/login?error=staff&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}
