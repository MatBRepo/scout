// lib/supabase/server.ts
import { cookies } from "next/headers"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
// import type { Database } from "@/lib/supabase/types"

export function createClient(/* cookie scope optional */): SupabaseClient /* <Database> */ {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // In RSC this will throw — swallow it. In Server Actions/Route Handlers it succeeds.
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // no-op in RSC; your middleware or next request will refresh cookies
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options })
          } catch {
            // no-op in RSC
          }
        },
      },
    }
  )
}
export default createClient
