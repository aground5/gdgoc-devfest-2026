import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Google OAuth returns here with ?code=…; exchange it for a session cookie,
// then go back to the page that started the login (same-site paths only).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/organize";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/organize";

  if (code) {
    const supabase = createClient(await cookies());
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}${next}${next.includes("?") ? "&" : "?"}login_error=1`);
}
