// lib/supabase/browser.ts
"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
// import type { Database } from "@/lib/supabase/types"

let _client: SupabaseClient /* <Database> */ | null = null

export function createClient(): SupabaseClient /* <Database> */ {
  if (_client) return _client
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return _client
}
export default createClient
