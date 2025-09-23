// src/app/api/scout/players/[playerId]/follow/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Optional: quick GET to sanity-check the route exists
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await ctx.params
  return NextResponse.json({ ok: true, playerId })
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await ctx.params
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  // Idempotent follow: ignore duplicates if it already exists
  const { error } = await supabase
    .from("players_scouts")
    .upsert(
      { player_id: playerId, scout_id: user.id },
      { onConflict: "player_id,scout_id", ignoreDuplicates: true }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await ctx.params
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const { error } = await supabase
    .from("players_scouts")
    .delete()
    .eq("player_id", playerId)
    .eq("scout_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
