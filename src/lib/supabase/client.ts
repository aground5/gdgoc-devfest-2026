// Supabase client for Client Components (uploads, realtime).

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

export const createClient = () => createBrowserClient<Database>(SUPABASE_URL, SUPABASE_KEY);
