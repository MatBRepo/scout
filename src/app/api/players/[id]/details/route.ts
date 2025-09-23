// src/app/api/players/[id]/details/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TM_API_BASE =
  process.env.TRANSFERMARKT_API_URL?.replace(/\/+$/, "") || "http://localhost:8000"
const TM_TIMEOUT_MS = Number(process.env.TM_API_TIMEOUT_MS || 12000)

function withTimeout<T>(p: Promise<T>, ms = TM_TIMEOUT_MS) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Transfermarkt API timeout")), ms)
    p.then((v) => {
      clearTimeout(t)
      resolve(v)
    }).catch((e) => {
      clearTimeout(t)
      reject(e)
    })
  })
}

async function tmFetch(path: string) {
  const url = `${TM_API_BASE}${path}`
  const res = await withTimeout(
    fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    })
  )
  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      msg = (j as any)?.detail || msg
    } catch {}
    throw new Error(`TM API ${res.status}: ${msg}`)
  }
  return res.json()
}

function parseTmIdFromUrl(u?: string | null) {
  if (!u) return null
  // https://www.transfermarkt.com/player-name/profil/spieler/38253
  const m = u.match(/\/spieler\/(\d+)(?:[/?]|$)/i)
  return m ? m[1] : null
}

// ✅ Next.js 15: params is a Promise
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params

    const supabase = await createClient()

    // 1) Load the canonical player by UUID
    const { data: player, error } = await supabase
      .from("players")
      .select(`
        id,
        full_name,
        date_of_birth,
        height_cm,
        weight_kg,
        dominant_foot,
        main_position,
        alt_positions,
        country_of_birth,
        current_club_name,
        current_club_country,
        current_club_tier,
        appearances,
        minutes,
        goals_last_season,
        assists_last_season,
        dribbles_last_season,
        transfermarkt_url,
        transfermarkt_player_id,
        image_url,
        agency,
        contract_until,
        contract_status
      `)
      .eq("id", id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    // 2) Resolve Transfermarkt ID
    let tmId: string | null = player.transfermarkt_player_id
    if (!tmId) tmId = parseTmIdFromUrl(player.transfermarkt_url)

    // 3) If we have a TM id, hit the local TM API concurrently
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let profile: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let market_value: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let stats: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let transfers: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let injuries: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let achievements: any = null
    const errors: Record<string, string> = {}

    if (tmId) {
      await Promise.all([
        tmFetch(`/players/${tmId}/profile`).then(
          (j) => (profile = j),
          (e) => (errors.profile = String(e?.message || e))
        ),
        tmFetch(`/players/${tmId}/market_value`).then(
          (j) => (market_value = j),
          (e) => (errors.market_value = String(e?.message || e))
        ),
        tmFetch(`/players/${tmId}/stats`).then(
          (j) => (stats = j),
          (e) => (errors.stats = String(e?.message || e))
        ),
        tmFetch(`/players/${tmId}/transfers`).then(
          (j) => (transfers = j),
          (e) => (errors.transfers = String(e?.message || e))
        ),
        tmFetch(`/players/${tmId}/injuries`).then(
          (j) => (injuries = j),
          (e) => (errors.injuries = String(e?.message || e))
        ),
        tmFetch(`/players/${tmId}/achievements`).then(
          (j) => (achievements = j),
          (e) => (errors.achievements = String(e?.message || e))
        ),
      ]).catch(() => {
        // individual promises already recorded their own errors
      })
    }

    // 4) Response shape the UI expects
    return NextResponse.json({
      player,          // from Supabase
      tm_id: tmId,     // helpful for debugging
      profile,         // TM profile (may be null)
      market_value,    // TM MV history (may be null)
      stats,           // TM stats (may be null)
      transfers,       // TM transfers (may be null)
      injuries,        // TM injuries (may be null)
      achievements,    // TM achievements (may be null)
      _errors: Object.keys(errors).length ? errors : undefined,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unexpected error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
