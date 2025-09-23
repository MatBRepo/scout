// src/app/api/admin/players/[id]/sync/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Use the env var in prod; don't default to localhost on Vercel
const TM_BASE = process.env.TRANSFERMARKT_API_BASE || "https://transfermarkt-api.fly.dev"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const norm = (s: string) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "")

const POS_MAP: Record<string, string> = {
  goalkeeper: "GK",
  "centre-back": "CB",
  "center-back": "CB",
  "right-back": "RB",
  "left-back": "LB",
  "right wing-back": "RWB",
  "right wing back": "RWB",
  "left wing-back": "LWB",
  "left wing back": "LWB",
  "defensive midfield": "DM",
  "central midfield": "CM",
  "attacking midfield": "AM",
  "right winger": "RW",
  "left winger": "LW",
  "second striker": "CF",
  "centre-forward": "CF",
  "center-forward": "CF",
  striker: "ST",
  cf: "CF",
  st: "ST",
  rw: "RW",
  lw: "LW",
  cm: "CM",
  am: "AM",
  dm: "DM",
  rb: "RB",
  lb: "LB",
  cb: "CB",
  gk: "GK",
}
function mapPosition(input?: string | null): string | null {
  if (!input) return null
  const k = norm(input).replace(/-/g, " ")
  return POS_MAP[k] ?? input
}
function parseDOBFromDescription(desc?: string | null): string | null {
  if (!desc) return null
  const m = desc.match(/\*\s*(\d{2})[./-](\d{2})[./-](\d{4})/)
  if (!m) return null
  const [, dd, mm, yyyy] = m
  return `${yyyy}-${mm}-${dd}`
}

async function tmSearchPlayers(q: string) {
  const r = await fetch(`${TM_BASE}/players/search/${encodeURIComponent(q)}?page_number=1`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  })
  if (!r.ok) throw new Error(`TM search ${r.status}`)
  return r.json()
}
async function tmGetProfile(id: string) {
  const r = await fetch(`${TM_BASE}/players/${id}/profile`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  })
  if (!r.ok) throw new Error(`TM profile ${id} ${r.status}`)
  return r.json()
}
function pickCandidate(results: any[], q: string) {
  const t = norm(q)
  let best = results.find((r: any) => norm(r.name) === t)
  if (!best) best = results.find((r: any) => norm(r.name).includes(t))
  if (!best) best = results.find((r: any) => (r?.club?.name || "").toLowerCase() !== "retired")
  return best ?? results[0]
}

// 🔧 params is a Promise in Next 15 route handlers
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const { data: p, error } = await supabase
    .from("players")
    .select(
      "id, full_name, date_of_birth, main_position, current_club_name, current_club_country, image_url, transfermarkt_player_id"
    )
    .eq("id", id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  try {
    let tmId: string | null = p.transfermarkt_player_id as any
    if (!tmId) {
      const res = await tmSearchPlayers(p.full_name)
      const results = Array.isArray(res?.results) ? res.results : []
      if (!results.length) {
        await supabase
          .from("players")
          .update({
            tm_sync_status: "not_found",
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", p.id)
        return NextResponse.json({ ok: true, matched: false })
      }
      tmId = String(pickCandidate(results, p.full_name)?.id ?? "")
    }
    if (!tmId) throw new Error("no candidate id")

    const profile = await tmGetProfile(tmId)
    await sleep(200)

    const mapped: Record<string, any> = {
      transfermarkt_player_id: tmId,
      transfermarkt_url: profile?.url ?? null,
      image_url: profile?.imageUrl ?? p.image_url ?? null,
      main_position: mapPosition(profile?.position?.main) ?? p.main_position ?? null,
      dominant_foot: profile?.foot ?? null,
      height_cm: typeof profile?.height === "number" ? profile.height : ((p as any)?.height_cm ?? null),
      country_of_birth: profile?.placeOfBirth?.country ?? ((p as any)?.country_of_birth ?? null),
      current_club_name: profile?.club?.name || p.current_club_name || null,
      contract_until: profile?.club?.contractExpires || null,
      date_of_birth: p.date_of_birth || parseDOBFromDescription(profile?.description),
      last_synced_at: new Date().toISOString(),
      tm_sync_status: "ok",
      tm_sync_error: null,
    }

    // best-effort snapshots (ignore failures)
    try {
      await supabase.from("external_profiles").insert({
        player_id: p.id,
        source: "transfermarkt",
        external_id: tmId,
        profile_url: mapped.transfermarkt_url,
        raw: profile,
      })
    } catch {}
    try {
      await supabase.from("tm_players_cache").upsert(
        {
          transfermarkt_player_id: tmId,
          profile,
          market_value: profile?.marketValue != null ? { eur: profile.marketValue } : null,
        },
        { onConflict: "transfermarkt_player_id" }
      )
    } catch {}

    const { error: upErr } = await supabase.from("players").update(mapped).eq("id", p.id)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

    const { data: updated } = await supabase
      .from("players")
      .select("id, full_name, image_url, transfermarkt_url, main_position, current_club_name, current_club_country")
      .eq("id", p.id)
      .single()

    return NextResponse.json({ ok: true, matched: true, player: updated || null })
  } catch (e: any) {
    await supabase
      .from("players")
      .update({
        tm_sync_status: "error",
        tm_sync_error: e?.message || String(e),
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", p.id)
    return NextResponse.json({ error: e?.message || "Sync failed" }, { status: 502 })
  }
}
