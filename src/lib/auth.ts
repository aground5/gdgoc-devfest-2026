// Who is signed in, and as what. Use in Server Components and Server Actions.

import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Viewer = {
  userId: string;
  email: string;
  participantId: string | null; // null = not a registered participant (e.g. staff-only account)
  isStaff: boolean;
};

// Once per request. Redirects to /login when signed out.
export const requireViewer = cache(async (next = "/onfestival"): Promise<Viewer> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect(`/login?next=${encodeURIComponent(next)}`);

  const [pid, staff] = await Promise.all([supabase.rpc("current_participant_id"), supabase.rpc("is_staff")]);
  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    participantId: pid.data ?? null,
    isStaff: staff.data === true,
  };
});
