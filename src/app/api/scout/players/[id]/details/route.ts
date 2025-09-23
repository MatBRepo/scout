// src/app/api/scout/players/[id]/details/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TM_BASE = process.env.TRANSFERMARKT_API_BASE || "http://localhost:8000"
const j = (r: Response) => r.json()
const ok = (r: Response) => { if (!r.ok) throw new Error(String(r.status)); return r }

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  // 1) Load core player row
  const { data: p, error } = await supabase
    .from("players")
    .select(`
      id, full_name, date_of_birth, height_cm, weight_kg, dominant_foot,
      main_position, alt_positions, country_of_birth, has_eu_passport,
      current_club_name, current_club_country, current_club_tier,
      transfermarkt_player_id, transfermarkt_url, image_url, last_synced_at
    `)
    .eq("id", params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // 2) If we have a TM id, pull full details live
  const tmId = p.transfermarkt_player_id
  let profile: any = null
  let marketValue: any = null
  let transfers: any = null
  let jerseyNumbers: any = null
  let stats: any = null
  let injuries: any = null
  let achievements: any = null

  if (tmId) {
    try {
      const [pr, mv, tr, jn, st, inj, ach] = await Promise.all([
        fetch(`${TM_BASE}/players/${tmId}/profile`, { headers: { accept: "application/json" } }).then(ok).then(j).catch(() => null),
        fetch(`${TM_BASE}/players/${tmId}/market_value`, { headers: { accept: "application/json" } }).then(ok).then(j).catch(() => null),
        fetch(`${TM_BASE}/players/${tmId}/transfers`, { headers: { accept: "application/json" } }).then(ok).then(j).catch(() => null),
        fetch(`${TM_BASE}/players/${tmId}/jersey_numbers`, { headers: { accept: "application/json" } }).then(ok).then(j).catch(() => null),
        fetch(`${TM_BASE}/players/${tmId}/stats`, { headers: { accept: "application/json" } }).then(ok).then(j).catch(() => null),
        fetch(`${TM_BASE}/players/${tmId}/injuries`, { headers: { accept: "application/json" } }).then(ok).then(j).catch(() => null),
        fetch(`${TM_BASE}/players/${tmId}/achievements`, { headers: { accept: "application/json" } }).then(ok).then(j).catch(() => null),
      ])
      profile = pr
      marketValue = mv
      transfers = tr
      jerseyNumbers = jn
      stats = st
      injuries = inj
      achievements = ach
    } catch (e) {
      // still return what we have
    }

    // 3) Best-effort cache (no .catch() chaining)
    try {
      await supabase.from("tm_players_cache").upsert({
        transfermarkt_player_id: tmId,
        profile,
        market_value: marketValue,
      }, { onConflict: "transfermarkt_player_id" })
    } catch {}
    try {
      if (profile) {
        await supabase.from("external_profiles").insert({
          player_id: p.id,
          source: "transfermarkt",
          external_id: tmId,
          profile_url: profile?.url || p.transfermarkt_url || null,
          raw: profile,
        })
      }
    } catch {}
  }

  return NextResponse.json({
    player: p,
    transfermarkt: {
      profile, marketValue, transfers, jerseyNumbers, stats, injuries, achievements,
    },
  })
}
