import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const body = await req.json()
  const allowed = [
    "full_name","date_of_birth","main_position","alt_positions","current_club_name",
    "current_club_country","current_club_tier","transfermarkt_url","image_url","image_path",
    "height_cm","weight_kg","dominant_foot","english_level","country_of_birth","has_eu_passport",
    "contract_until","contract_status","agency","release_clause",
    "appearances","minutes","national_team_caps","national_team_minutes",
    "goals_last_season","assists_last_season","dribbles_last_season"
  ] as const
  const patch: Record<string, any> = {}
  for (const k of allowed) if (k in body) patch[k] = body[k]

  const { error } = await supabase.from("players").update(patch).eq("id", params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const { error } = await supabase.from("players").delete().eq("id", params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
