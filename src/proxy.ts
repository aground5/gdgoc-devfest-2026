import type { NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

// Next.js 16 "proxy" (formerly middleware): keeps the Supabase session fresh.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static files and images
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
