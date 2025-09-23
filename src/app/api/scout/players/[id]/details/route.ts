// src/app/api/scout/players/[id]/details/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Transfermarkt microservice base (trim trailing "/")
const TM_BASE = (process.env.TRANSFERMARKT_API_BASE ?? "http://localhost:8000").replace(/\/+$/, "")
const TM_TIMEOUT_MS = Number(process.env.TM_API_TIMEOUT_MS || 12000)

function withTimeout<T>(p: Promise<T>, ms = TM_TIMEOUT_MS) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Transfermarkt API timeout")), ms)
    p.then((v) => { clearTimeout(t); resolve(v) })
     .catch((e) => { clearTimeout(t); reject(e) })
  })
}

async function tmJson(path: string): Promise<unknown> {
  const res = await withTimeout(
    fetch(`${TM_BASE}${path}`, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    })
  )
  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = await res.json()
      msg = j?.detail || j?.error || msg
    } catch {}
    throw new Error(`TM ${res.status}: ${msg}`)
  }
  return res.json()
}

type PlayerCore = {
  id: string
  full_name: string
  date_of_birth: string | null
  height_cm: number | null
  weight_kg: number | null
  dominant_foot: string | null
  main_position: string | null
  alt_positions: string[] | null
  country_of_birth: string | null
  has_eu_passport: boolean | null
  current_club_name: string | null
  current_club_country: string | null
  current_club_tier: string | null
  transfermarkt_player_id: string | null
  transfermarkt_url: string | null
  image_url: string | null
  last_synced_at: string | null
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
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
    .eq("id", id)
    .maybeSingle<PlayerCore>()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  if (!p) return NextResponse.json({ error: "not_found" }, { status: 404 })

  // 2) If we have a TM id, pull details in parallel
  const tmId = p.transfermarkt_player_id
  let profile: unknown = null
  let marketValue: unknown = null
  let transfers: unknown = null
  let jerseyNumbers: unknown = null
  let stats: unknown = null
  let injuries: unknown = null
  let achievements: unknown = null

  if (tmId) {
    const results = await Promise.allSettled([
      tmJson(`/players/${tmId}/profile`),
      tmJson(`/players/${tmId}/market_value`),
      tmJson(`/players/${tmId}/transfers`),
      tmJson(`/players/${tmId}/jersey_numbers`),
      tmJson(`/players/${tmId}/stats`),
      tmJson(`/players/${tmId}/injuries`),
      tmJson(`/players/${tmId}/achievements`),
    ])
    const pick = (i: number) => (results[i].status === "fulfilled" ? results[i].value : null)

    profile = pick(0)
    marketValue = pick(1)
    transfers = pick(2)
    jerseyNumbers = pick(3)
    stats = pick(4)
    injuries = pick(5)
    achievements = pick(6)

    // 3) Best-effort cache; ignore failures
    try {
      await supabase
        .from("tm_players_cache")
        .upsert(
          {
            transfermarkt_player_id: tmId,
            // Supabase JSON columns; allow raw snapshot
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            profile: profile as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            market_value: marketValue as any,
          },
          { onConflict: "transfermarkt_player_id" }
        )
    } catch {}

    try {
      if (profile) {
        const url =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((profile as any)?.url as string | undefined) ?? p.transfermarkt_url ?? null
        await supabase.from("external_profiles").insert({
          player_id: p.id,
          source: "transfermarkt",
          external_id: tmId,
          profile_url: url,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          raw: profile as any,
        })
      }
    } catch {}
  }

  return NextResponse.json({
    player: p,
    transfermarkt: { profile, marketValue, transfers, jerseyNumbers, stats, injuries, achievements },
  })
}
