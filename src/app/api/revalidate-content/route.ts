import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Staff call this after saving guide content so the public page is rebuilt
// right away instead of waiting for the periodic refresh.
export async function POST() {
  const supabase = createClient(await cookies());
  const { data: staff } = await supabase.rpc("is_staff");
  if (!staff) return NextResponse.json({ ok: false }, { status: 403 });
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
