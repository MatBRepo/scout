// src/app/scout/observations/(api)/[id]/players/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json() // { player_id?, player_entry_id?, ... }
  const supabase = await createClient()

  // Example validation
  if (!body.player_id && !body.player_entry_id) {
    return NextResponse.json({ error: "Provide player_id or player_entry_id" }, { status: 400 })
  }

  const { error } = await supabase.from("observation_players").insert({
    observation_id: id,
    player_id: body.player_id ?? null,
    player_entry_id: body.player_entry_id ?? null,
    minutes_watched: body.minutes_watched ?? null,
    rating: body.rating ?? null,
    notes: body.notes ?? null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
