"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { participantEmail, parseCode } from "@/lib/festival/login-code";

export type LoginState = { step: "email" | "code"; email: string; next: string; error?: string };

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

// Staff: whitelisted emails get a magic link + 6-digit code.

// Only paths on this site, so the link can't be turned into an open redirect.
const safeNext = (next: string) => (next.startsWith("/") && !next.startsWith("//") ? next : "/onfestival");

export async function sendLink(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(String(form.get("next") ?? "/organize"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith("@participants.devfest.invalid")) {
    return { step: "email", email, next, error: "이메일 주소를 확인해 주세요." };
  }
  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${origin}${next}` },
  });
  // Same message for emails not on the staff list, so the form doesn't reveal who is staff.
  if (error && error.status !== 403 && error.status !== 422) {
    return { step: "email", email, next, error: "메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
  return { step: "code", email, next };
}

// Email and next come from hidden fields in the code form.
export async function verifyCode(_: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const email = String(form.get("email") ?? "");
  const next = safeNext(String(form.get("next") ?? ""));
  const token = String(form.get("code") ?? "").replace(/\D/g, "");
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { error: "코드가 맞지 않거나 만료되었습니다." };
  redirect(next);
}
