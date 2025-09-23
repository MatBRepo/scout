// src/app/scout/observations/[id]/players/[rowId]/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type GuardResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

async function assertOwner(
  supabase: ReturnType<typeof createClient>,
  rowId: string,
  userId: string
): Promise<GuardResult> {
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

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ rowId: string }> }
) {
  const { rowId } = await ctx.params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const guard = await assertOwner(supabase, rowId, user.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  // Build a sparse update object so we don’t wipe fields unintentionally
  const update: {
    minutes_watched?: number | null
    rating?: number | null
    notes?: string | null
  } = {}

  if ("minutes_watched" in body) {
    update.minutes_watched =
      typeof body.minutes_watched === "number" ? body.minutes_watched : null
  }
  if ("rating" in body) {
    update.rating = typeof body.rating === "number" ? body.rating : null
  }
  if ("notes" in body) {
    update.notes = typeof body.notes === "string" ? body.notes : null
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const { error } = await supabase.from("observation_players").update(update).eq("id", rowId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ rowId: string }> }
) {
  const { rowId } = await ctx.params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const guard = await assertOwner(supabase, rowId, user.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { error } = await supabase.from("observation_players").delete().eq("id", rowId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
