import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// Verify the row belongs to the current user by hopping through observation_sessions
async function assertOwner(rowId: string, userId: string) {
  const supabase = await createClient()
  const { data: row } = await supabase
    .from("observation_players")
    .select("id, observation_id")
    .eq("id", rowId)
    .maybeSingle()
  if (!row) return { ok: false, status: 404, error: "Row not found" }

  const { data: obs } = await supabase
    .from("observation_sessions")
    .select("id, scout_id")
    .eq("id", row.observation_id)
    .maybeSingle()
  if (!obs) return { ok: false, status: 404, error: "Observation not found" }
  if (obs.scout_id !== userId) return { ok: false, status: 403, error: "Forbidden" }

  return { ok: true }
}

export async function PATCH(req: Request, { params }: { params: { rowId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const guard = await assertOwner(params.rowId, user.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const patch = await req.json().catch(() => ({}))
  const update = {
    minutes_watched: typeof patch.minutes_watched === "number" ? patch.minutes_watched : null,
    rating: patch.rating ?? null,
    notes: typeof patch.notes === "string" ? patch.notes : null,
  }

  const { error } = await supabase
    .from("observation_players")
    .update(update)
    .eq("id", params.rowId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: { rowId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const guard = await assertOwner(params.rowId, user.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { error } = await supabase
    .from("observation_players")
    .delete()
    .eq("id", params.rowId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
