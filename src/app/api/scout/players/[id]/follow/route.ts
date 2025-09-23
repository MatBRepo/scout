// src/app/api/scout/players/[playerId]/follow/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Optional: quick GET to sanity-check the route exists
export async function GET(
  _req: Request,
  { params }: { params: { playerId: string } }
) {
  return NextResponse.json({ ok: true, playerId: params.playerId })
}

export async function POST(
  _req: Request,
  { params }: { params: { playerId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const { error } = await supabase
    .from("players_scouts")
    .insert({ player_id: params.playerId, scout_id: user.id })

  if (error) {
    // Ignore duplicate key errors so the action is idempotent
    if ((error as any).code === "23505") return NextResponse.json({ ok: true })
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { playerId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const { error } = await supabase
    .from("players_scouts")
    .delete()
    .eq("player_id", params.playerId)
  .eq("scout_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
