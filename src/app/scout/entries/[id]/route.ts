// src/app/api/scout/players/[id]/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type AllowedKeys =
  | "full_name"
  | "date_of_birth"
  | "main_position"
  | "current_club_name"
  | "transfermarkt_url"
  | "opinion"
  | "image_url"
  | "image_path"
  | "status"

const ALLOWED_KEYS = [
  "full_name",
  "date_of_birth",
  "main_position",
  "current_club_name",
  "transfermarkt_url",
  "opinion",
  "image_url",
  "image_path",
  "status",
] as const satisfies Readonly<AllowedKeys[]>

type EntryPatch = Partial<Record<AllowedKeys, unknown>>

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const { error } = await supabase.from("scout_player_entries").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const raw = (await req.json()) as Record<string, unknown>

  const patch: EntryPatch = Object.fromEntries(
    Object.entries(raw).filter(([k]) => (ALLOWED_KEYS as readonly string[]).includes(k))
  ) as EntryPatch

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true }) // nothing to update
  }

  const { error } = await supabase
    .from("scout_player_entries")
    // patch is unknown-typed but valid; Supabase accepts generic objects
    .update(patch as Record<string, unknown>)
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
