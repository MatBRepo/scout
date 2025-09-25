import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const OP_ROW_SELECT = `
  id, observation_id, player_id, player_entry_id,
  minutes_watched, rating,
  offense_rating, defense_rating, technique_rating, motor_rating,
  played_position,
  notes,
  players ( id, full_name, image_url, transfermarkt_url ),
  scout_player_entries ( id, full_name, image_url, transfermarkt_url )
`

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ opId: string }> }
) {
  const { opId } = await ctx.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  // Find the row & ensure ownership (through its observation)
  const { data: row0, error: findErr } = await supabase
    .from("observation_players")
    .select("id, observation_id")
    .eq("id", opId)
    .maybeSingle()
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 400 })
  if (!row0) return NextResponse.json({ error: "Row not found" }, { status: 404 })

  const { data: obs } = await supabase
    .from("observation_sessions")
    .select("id, scout_id")
    .eq("id", row0.observation_id)
    .maybeSingle()
  if (!obs) return NextResponse.json({ error: "Observation not found" }, { status: 404 })
  if (obs.scout_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))

  // Only allow known fields
  const allowed = [
    "minutes_watched",
    "rating",
    "notes",
    "offense_rating",
    "defense_rating",
    "technique_rating",
    "motor_rating",
    "played_position", // NEW
  ] as const

  const patch: Record<string, any> = {}
  for (const k of allowed) if (k in body) patch[k] = (body as any)[k] ?? null

  const { data, error } = await supabase
    .from("observation_players")
    .update(patch)
    .eq("id", opId)
    .select(OP_ROW_SELECT)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, row: data })
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ opId: string }> }
) {
  const { opId } = await ctx.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  // Ownership via observation
  const { data: row0 } = await supabase
    .from("observation_players")
    .select("id, observation_id")
    .eq("id", opId)
    .maybeSingle()
  if (!row0) return NextResponse.json({ error: "Row not found" }, { status: 404 })

  const { data: obs } = await supabase
    .from("observation_sessions")
    .select("id, scout_id")
    .eq("id", row0.observation_id)
    .maybeSingle()
  if (!obs) return NextResponse.json({ error: "Observation not found" }, { status: 404 })
  if (obs.scout_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { error } = await supabase.from("observation_players").delete().eq("id", opId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
