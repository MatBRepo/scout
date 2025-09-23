// src/app/api/admin/scouts/set-role/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const scout_id = body?.scout_id as string | undefined
  const role = body?.role as "scout" | "admin" | undefined
  if (!scout_id || (role !== "scout" && role !== "admin")) {
    return NextResponse.json({ error: "missing_or_invalid_role" }, { status: 400 })
  }

  const { error } = await supabase.from("profiles").update({ role }).eq("id", scout_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
