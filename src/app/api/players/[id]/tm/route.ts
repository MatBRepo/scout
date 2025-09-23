// src/app/api/players/[id]/tm/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: p, error } = await supabase
    .from("players")
    .select("transfermarkt_player_id")
    .eq("id", params.id)
    .maybeSingle()
  if (error || !p?.transfermarkt_player_id)
    return NextResponse.json({ error: "not_found" }, { status: 404 })

  const { data: cache } = await supabase
    .from("tm_players_cache")
    .select("profile, market_value, cached_at")
    .eq("transfermarkt_player_id", p.transfermarkt_player_id)
    .maybeSingle()

  return NextResponse.json(cache || { })
}
