// src/app/scout/observations/(api)/players/[rowId]/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ rowId: string }> }
) {
  const { rowId } = await params
  const body = await req.json()
  const supabase = await createClient()

  const { error } = await supabase
    .from("observation_players")
    .update({
      minutes_watched: body.minutes_watched ?? null,
      rating: body.rating ?? null,
      notes: body.notes ?? null,
    })
    .eq("id", rowId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ rowId: string }> }
) {
  const { rowId } = await params
  const supabase = await createClient()
  const { error } = await supabase.from("observation_players").delete().eq("id", rowId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
