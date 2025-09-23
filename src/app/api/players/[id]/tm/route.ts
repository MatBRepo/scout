// src/app/api/players/[id]/tm/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const supabase = await createClient()

    const { data: p, error } = await supabase
      .from("players")
      .select("transfermarkt_player_id")
      .eq("id", id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!p?.transfermarkt_player_id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }

    const { data: cache, error: cacheErr } = await supabase
      .from("tm_players_cache")
      .select("profile, market_value, cached_at")
      .eq("transfermarkt_player_id", p.transfermarkt_player_id)
      .maybeSingle()

    if (cacheErr) {
      return NextResponse.json({ error: cacheErr.message }, { status: 500 })
    }

    // return empty object if no cache yet
    return NextResponse.json(cache ?? {})
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unexpected error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
