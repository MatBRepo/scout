// src/app/scout/observations/(api)/sessions/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase
    .from("observation_sessions")
    .insert({
      scout_id: user.id,
      title: body.title ?? null,
      match_date: body.match_date ?? null,
      competition: body.competition ?? null,
      opponent: body.opponent ?? null,
      notes: body.notes ?? null,
    })
    .select("*").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ session: data })
}
