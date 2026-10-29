// Magic link target: /auth/confirm?token_hash=...&type=email&next=...
// Uses the token hash (not PKCE), so the link also works when opened in another browser.

import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "email") as EmailOtpType;

  // `next` may be a full URL (the email's redirect) or a path; keep only a path on this site.
  let next = "/onfestival";
  try {
    const url = new URL(searchParams.get("next") || "/onfestival", origin);
    if (url.origin === origin) next = url.pathname + url.search;
  } catch {}

  if (tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL(`/login?error=link&next=${encodeURIComponent(next)}`, origin));
}
