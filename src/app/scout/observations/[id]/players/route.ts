import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// Reuse the same SELECT fragment everywhere so all fields stay in sync
const OP_ROW_SELECT = `
  id, observation_id, player_id, player_entry_id,
  minutes_watched, rating,
  offense_rating, defense_rating, technique_rating, motor_rating,
  played_position,
  notes, created_at,
  players ( id, full_name, image_url, transfermarkt_url ),
  scout_player_entries ( id, full_name, image_url, transfermarkt_url )
`

/** Add a player (canonical or entry) to an observation */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: observationId } = await ctx.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  // Ensure the observation belongs to the current user
  const { data: obs } = await supabase
    .from("observation_sessions")
    .select("id, scout_id")
    .eq("id", observationId)
    .maybeSingle()

  if (!obs) return NextResponse.json({ error: "Observation not found" }, { status: 404 })
  if (obs.scout_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const player_id = typeof body.player_id === "string" ? body.player_id : undefined
  const player_entry_id = typeof body.player_entry_id === "string" ? body.player_entry_id : undefined

  // Exactly one of player_id or player_entry_id
  if ((!player_id && !player_entry_id) || (player_id && player_entry_id)) {
    return NextResponse.json(
      { error: "Provide exactly one of player_id or player_entry_id" },
      { status: 400 }
    )
  }

  // Duplicate guard
  let dupQ = supabase
    .from("observation_players")
    .select("id")
    .eq("observation_id", observationId)

  if (player_id) dupQ = dupQ.eq("player_id", player_id)
  if (player_entry_id) dupQ = dupQ.eq("player_entry_id", player_entry_id)

  const { data: existing } = await dupQ.maybeSingle()
  if (existing) return NextResponse.json({ error: "Already added" }, { status: 409 })

  const insert = {
    observation_id: observationId,
    player_id: player_id ?? null,
    player_entry_id: player_entry_id ?? null,
  }

  const { data: row, error } = await supabase
    .from("observation_players")
    .insert(insert)
    .select(OP_ROW_SELECT)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ row })
}

/** List all players already attached to an observation */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: observationId } = await ctx.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { data: obs } = await supabase
    .from("observation_sessions")
    .select("id, scout_id")
    .eq("id", observationId)
    .maybeSingle()

  if (!obs) return NextResponse.json({ error: "Observation not found" }, { status: 404 })
  if (obs.scout_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data, error } = await supabase
    .from("observation_players")
    .select(OP_ROW_SELECT)
    .eq("observation_id", observationId)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ rows: data ?? [] })
}
