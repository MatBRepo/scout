// src/app/scout/observations/[id]/players/[rowId]/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"

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

type GuardResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

async function assertOwner(
  supabase: SupabaseClient,
  rowId: string,
  userId: string
): Promise<GuardResult> {
  const { data: row, error: rowErr } = await supabase
    .from("observation_players")
    .select("id, observation_id")
    .eq("id", rowId)
    .maybeSingle()

  if (rowErr) return { ok: false, status: 400, error: rowErr.message }
  if (!row) return { ok: false, status: 404, error: "Row not found" }

  const { data: obs, error: obsErr } = await supabase
    .from("observation_sessions")
    .select("id, scout_id")
    .eq("id", row.observation_id)
    .maybeSingle()

  if (obsErr) return { ok: false, status: 400, error: obsErr.message }
  if (!obs) return { ok: false, status: 404, error: "Observation not found" }
  if (obs.scout_id !== userId) return { ok: false, status: 403, error: "Forbidden" }

  return { ok: true }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ rowId: string }> }
) {
  const { rowId } = await ctx.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const guard = await assertOwner(supabase, rowId, user.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  // Allow only known fields (superset from your [opId] handler)
  const allowed = [
    "minutes_watched",
    "rating",
    "notes",
    "offense_rating",
    "defense_rating",
    "technique_rating",
    "motor_rating",
    "played_position",
  ] as const

  const patch: Record<string, any> = {}
  for (const k of allowed) {
    if (k in body) patch[k] = (body as any)[k] ?? null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("observation_players")
    .update(patch)
    .eq("id", rowId)
    .select(OP_ROW_SELECT)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, row: data })
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ rowId: string }> }
) {
  const { rowId } = await ctx.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const guard = await assertOwner(supabase, rowId, user.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { error } = await supabase
    .from("observation_players")
    .delete()
    .eq("id", rowId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
