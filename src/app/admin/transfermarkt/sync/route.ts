// src/app/api/admin/transfermarkt/sync/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TM_BASE = process.env.TRANSFERMARKT_API_BASE || "https://transfermarkt-api.fly.dev"
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const norm = (s: string) =>
  s?.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]/g, "") || ""

async function searchPlayerByName(name: string) {
  const url = `${TM_BASE}/players/search/${encodeURIComponent(name)}`
  const r = await fetch(url, { headers: { accept: "application/json" } })
  if (!r.ok) throw new Error(`TM search ${r.status}`)
  return r.json()
}
async function getPlayerProfile(id: string) {
  const r = await fetch(`${TM_BASE}/players/${id}/profile`, { headers: { accept: "application/json" } })
  if (!r.ok) throw new Error(`TM profile ${id} ${r.status}`)
  return r.json()
}
async function getPlayerMarketValue(id: string) {
  const r = await fetch(`${TM_BASE}/players/${id}/market_value`, { headers: { accept: "application/json" } })
  if (!r.ok) return null
  return r.json()
}
function pickCandidate(cands: any[], name: string, dob?: string | null) {
  const target = norm(name)
  let best = cands.find((c: any) => norm(c?.name || c?.playerName) === target)
  if (!best) best = cands.find((c: any) => (norm(c?.name || c?.playerName) || "").includes(target))
  if (!best && dob) best = cands.find((c: any) => (c?.birthDate || c?.dateOfBirth || "").startsWith(dob))
  return best || cands?.[0]
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const playerId = url.searchParams.get("player_id")
  const scope = (url.searchParams.get("scope") || "missing") as "missing" | "all"

  // ---- Per-player mode ----
  if (playerId) {
    const { data: p, error } = await supabase
      .from("players")
      .select("id, full_name, date_of_birth, main_position, current_club_name, current_club_country, image_url")
      .eq("id", playerId)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 404 })

    try {
      const results = await searchPlayerByName(p.full_name)
      if (!Array.isArray(results) || results.length === 0) {
        await supabase.from("players").update({
          tm_sync_status: "not_found",
          last_synced_at: new Date().toISOString(),
        }).eq("id", p.id)
        return NextResponse.json({ ok: true, matched: false, updated: 0, notFound: 1 })
      }

      const cand = pickCandidate(results, p.full_name, p.date_of_birth as any)
      const tmId = String(cand?.id ?? cand?.playerId ?? "")
      if (!tmId) throw new Error("no candidate id")

      const profile = await getPlayerProfile(tmId)
      await sleep(400)
      const mv = await getPlayerMarketValue(tmId).catch(() => null)

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

      await supabase.from("tm_players_cache").upsert({
        transfermarkt_player_id: tmId,
        profile,
        market_value: mv,
        cached_at: new Date().toISOString(),
      })

      await supabase.from("external_profiles").insert({
        player_id: p.id,
        source: "transfermarkt",
        external_id: tmId,
        profile_url: mapped.transfermarkt_url,
        raw: profile,
      })

      const { error: upErr } = await supabase.from("players").update(mapped).eq("id", p.id)
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

      const { data: updatedRow } = await supabase
        .from("players")
        .select("id, full_name, image_url, transfermarkt_url")
        .eq("id", p.id)
        .single()

      return NextResponse.json({
        ok: true, matched: true, updated: 1, notFound: 0, player: updatedRow || null
      })
    } catch (e: any) {
      await supabase.from("players").update({
        tm_sync_status: "error",
        tm_sync_error: e?.message || String(e),
        last_synced_at: new Date().toISOString(),
      }).eq("id", playerId)
      return NextResponse.json({ error: e?.message || "Sync failed" }, { status: 502 })
    }
  }

  // ---- Batch mode ----
  const sel = supabase
    .from("players")
    .select("id, full_name, date_of_birth, main_position, current_club_name, current_club_country, image_url, transfermarkt_player_id")
    .order("created_at", { ascending: false })

  const { data: players, error: selErr } = scope === "all" ? await sel : await sel.is("transfermarkt_player_id", null)
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 400 })

  let scanned = 0, matched = 0, updated = 0, notFound = 0
  const errors: Array<{ id: string; msg: string }> = []

  for (const p of players ?? []) {
    scanned++
    try {
      const results = await searchPlayerByName(p.full_name)
      await sleep(1200)

      if (!Array.isArray(results) || results.length === 0) {
        notFound++
        await supabase.from("players").update({
          tm_sync_status: "not_found",
          tm_sync_error: null,
          last_synced_at: new Date().toISOString(),
        }).eq("id", p.id)
        continue
      }

      const cand = pickCandidate(results, p.full_name, p.date_of_birth as any)
      const tmId = String(cand?.id ?? cand?.playerId ?? "")
      if (!tmId) throw new Error("no candidate id")

      const profile = await getPlayerProfile(tmId)
      await sleep(800)
      const mv = await getPlayerMarketValue(tmId).catch(() => null)

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

      await supabase.from("tm_players_cache").upsert({
        transfermarkt_player_id: tmId,
        profile,
        market_value: mv,
        cached_at: new Date().toISOString(),
      })

      await supabase.from("external_profiles").insert({
        player_id: p.id,
        source: "transfermarkt",
        external_id: tmId,
        profile_url: mapped.transfermarkt_url,
        raw: profile,
      })

      const { error: upErr } = await supabase.from("players").update(mapped).eq("id", p.id)
      if (upErr) throw upErr

      matched++; updated++
    } catch (e: any) {
      errors.push({ id: p.id, msg: e?.message || String(e) })
      await supabase.from("players").update({
        tm_sync_status: "error",
        tm_sync_error: e?.message || String(e),
        last_synced_at: new Date().toISOString(),
      }).eq("id", p.id)
      await sleep(1500)
      continue
    }
  }

  return NextResponse.json({ scope, scanned, matched, updated, notFound, errors })
}
