// src/app/api/scout/entries/[id]/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type AllowedKey =
  | "full_name"
  | "date_of_birth"
  | "main_position"
  | "current_club_name"
  | "transfermarkt_url"
  | "opinion"
  | "image_url"
  | "image_path"
  | "status"

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

  const body = (await req.json()) as Record<string, unknown>

  // Build a typed, whitelisted patch
  const allowed: readonly AllowedKey[] = [
    "full_name",
    "date_of_birth",
    "main_position",
    "current_club_name",
    "transfermarkt_url",
    "opinion",
    "image_url",
    "image_path",
    "status",
  ] as const

  const patch: Partial<Record<AllowedKey, unknown>> = {}
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      patch[k] = body[k]
    }
  }

  const { error } = await supabase
    .from("scout_player_entries")
    .update(patch)
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

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
