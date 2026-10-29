// Google sign-in returns here with ?code=... (PKCE). Exchanges it for a session cookie.
// If the email isn't on the staff whitelist, the auth hook rejects the sign-up and
// Supabase sends ?error=... instead.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = searchParams.get("next") ?? "/organize";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/organize";
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, origin));
  }
  return NextResponse.redirect(new URL(`/login?error=staff&next=${encodeURIComponent(safeNext)}`, origin));
}
