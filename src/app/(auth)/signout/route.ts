// src/app/(auth)/signout/route.ts
import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL("/(auth)", req.url), { status: 302 })
}

// Support POST too (e.g., if a form posts to this endpoint)
export const POST = GET
