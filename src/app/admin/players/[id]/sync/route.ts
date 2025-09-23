// src/app/api/admin/players/[id]/sync/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TM_BASE = process.env.TRANSFERMARKT_API_BASE || "https://transfermarkt-api.fly.dev"
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const norm = (s: string) =>
  s?.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]/g, "") || ""

async function searchPlayerByName(name: string) {
  const r = await fetch(`${TM_BASE}/players/search/${encodeURIComponent(name)}`, { headers: { accept: "application/json" } })
  if (!r.ok) throw new Error(`TM search ${r.status}`)
  return r.json()
}
async function getPlayerProfile(id: string) {
  const r = await fetch(`${TM_BASE}/players/${id}/profile`, { headers: { accept: "application/json" } })
  if (!r.ok) throw new Error(`TM profile ${id} ${r.status}`)
  return r.json()
}
function pickCandidate(cands: any[], name: string, dob?: string | null) {
  const target = norm(name)
  let best = cands.find((c: any) => norm(c?.name || c?.playerName) === target)
  if (!best) best = cands.find((c: any) => (norm(c?.name || c?.playerName) || "").includes(target))
  if (!best && dob) best = cands.find((c: any) => (c?.birthDate || c?.dateOfBirth || "").startsWith(dob))
  return best || cands?.[0]
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const { data: p, error } = await supabase
    .from("players")
    .select("id, full_name, date_of_birth, main_position, current_club_name, current_club_country, image_url")
    .eq("id", params.id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  try {
    const items = await searchPlayerByName(p.full_name)
    if (!Array.isArray(items) || items.length === 0) {
      await supabase.from("players").update({
        tm_sync_status: "not_found",
        last_synced_at: new Date().toISOString(),
      }).eq("id", p.id)
      return NextResponse.json({ ok: true, matched: false })
    }

    const cand = pickCandidate(items, p.full_name, p.date_of_birth as any)
    const tmId = String(cand?.id ?? cand?.playerId ?? "")
    if (!tmId) throw new Error("no candidate id")

    const profile = await getPlayerProfile(tmId)
    await sleep(400)

    const mapped: Record<string, any> = {
      transfermarkt_player_id: tmId,
      transfermarkt_url: profile?.profileUrl || cand?.profileUrl || cand?.url || null,
      image_url: profile?.image || cand?.image || p.image_url || null,
      main_position: profile?.position || profile?.mainPosition || p.main_position || null,
      current_club_name: profile?.club?.name || profile?.currentClub?.name || p.current_club_name || null,
      current_club_country: profile?.club?.country || profile?.currentClub?.country || p.current_club_country || null,
      last_synced_at: new Date().toISOString(),
      tm_sync_status: "ok",
      tm_sync_error: null,
    }

    await supabase.from("external_profiles").insert({
      player_id: p.id,
      source: "transfermarkt",
      external_id: tmId,
      profile_url: mapped.transfermarkt_url,
      raw: profile,
    })

    const { error: upErr } = await supabase.from("players").update(mapped).eq("id", p.id)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

    // Return the updated row for instant UI patch
    const { data: updated } = await supabase
      .from("players")
      .select("id, full_name, image_url, transfermarkt_url")
      .eq("id", p.id)
      .single()

    return NextResponse.json({ ok: true, matched: true, player: updated || null })
  } catch (e: any) {
    await supabase.from("players").update({
      tm_sync_status: "error",
      tm_sync_error: e?.message || String(e),
      last_synced_at: new Date().toISOString(),
    }).eq("id", p.id)
    return NextResponse.json({ error: e?.message || "Sync failed" }, { status: 502 })
  }
}
