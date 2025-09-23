// src/app/scout/observations/(api)/voice-notes/list/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const observationId = searchParams.get("observationId")
    const playerId = searchParams.get("playerId")
    const observationPlayerId = searchParams.get("observationPlayerId")

    let q = supabase
      .from("observation_voice_notes")
      .select("id, observation_id, observation_player_id, player_id, storage_path, transcript, status, duration_sec, created_at")
      .eq("scout_id", user.id)

    if (observationId) q = q.eq("observation_id", observationId)
    if (playerId) q = q.eq("player_id", playerId)
    if (observationPlayerId) q = q.eq("observation_player_id", observationPlayerId)

    const { data, error } = await q.order("created_at", { ascending: false })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server_error" }, { status: 500 })
  }
}
