// src/app/api/players/[id]/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type AllowedKey =
  | "full_name"
  | "date_of_birth"
  | "main_position"
  | "alt_positions"
  | "current_club_name"
  | "current_club_country"
  | "current_club_tier"
  | "transfermarkt_url"
  | "image_url"
  | "image_path"
  | "height_cm"
  | "weight_kg"
  | "dominant_foot"
  | "english_level"
  | "country_of_birth"
  | "has_eu_passport"
  | "contract_until"
  | "contract_status"
  | "agency"
  | "release_clause"
  | "appearances"
  | "minutes"
  | "national_team_caps"
  | "national_team_minutes"
  | "goals_last_season"
  | "assists_last_season"
  | "dribbles_last_season"

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

  const allowed: readonly AllowedKey[] = [
    "full_name",
    "date_of_birth",
    "main_position",
    "alt_positions",
    "current_club_name",
    "current_club_country",
    "current_club_tier",
    "transfermarkt_url",
    "image_url",
    "image_path",
    "height_cm",
    "weight_kg",
    "dominant_foot",
    "english_level",
    "country_of_birth",
    "has_eu_passport",
    "contract_until",
    "contract_status",
    "agency",
    "release_clause",
    "appearances",
    "minutes",
    "national_team_caps",
    "national_team_minutes",
    "goals_last_season",
    "assists_last_season",
    "dribbles_last_season",
  ] as const

  const patch: Partial<Record<AllowedKey, unknown>> = {}
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      patch[k] = body[k]
    }
  }

  const { error } = await supabase.from("players").update(patch).eq("id", id)
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

  const { error } = await supabase.from("players").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
