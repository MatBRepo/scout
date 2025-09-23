// src/app/api/admin/transfermarkt/import/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TM_BASE = process.env.TRANSFERMARKT_API_BASE || "http://localhost:8000"
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// diacritic/space insensitive
const norm = (s: string) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "")

type SearchResult = {
  id: string
  name: string
  position?: string | null
  club?: { id?: string; name?: string | null } | null
  age?: number | null
  nationalities?: string[]
  marketValue?: number | null
}

async function tmSearchPlayers(q: string, page = 1) {
  const url = `${TM_BASE}/players/search/${encodeURIComponent(q)}?page_number=${page}`
  const r = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" })
  if (!r.ok) throw new Error(`TM search ${r.status}`)
  return r.json() as Promise<{ results: SearchResult[] }>
}

async function tmGetProfile(id: string) {
  const r = await fetch(`${TM_BASE}/players/${id}/profile`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  })
  if (!r.ok) throw new Error(`TM profile ${id} ${r.status}`)
  return r.json()
}

function pickCandidate(results: SearchResult[], q: string) {
  const target = norm(q)
  // 1) exact normalized match
  let best = results.find(r => norm(r.name) === target)
  // 2) includes
  if (!best) best = results.find(r => norm(r.name).includes(target))
  // 3) prefer not retired if several similar
  if (!best) best = results.find(r => (r.club?.name || "").toLowerCase() !== "retired")
  return best ?? results[0]
}

async function upsertPlayerFromProfile(
  supabase: any,
  profile: any,
  candidate?: SearchResult
) {
  // Try to be defensive about field names coming from the scraper
  const fullName: string | null =
    profile?.name || profile?.fullName || candidate?.name || null
  const dobRaw: string | null =
    profile?.dateOfBirth || profile?.birthDate || null
  const dob = dobRaw ? String(dobRaw).slice(0, 10) : null

  if (!fullName || !dob) {
    return { error: "Missing full name or date of birth from Transfermarkt" }
  }

  const tmId: string | null = String(profile?.id ?? profile?.playerId ?? candidate?.id ?? "")
  const tmUrl: string | null = profile?.profileUrl ?? null
  const img: string | null = profile?.image ?? null

  const mainPosition: string | null =
    profile?.position || profile?.mainPosition || candidate?.position || null

  const clubName: string | null =
    profile?.club?.name || profile?.currentClub?.name || candidate?.club?.name || null

  const clubCountry: string | null =
    profile?.club?.country || profile?.currentClub?.country || null

  const mapped = {
    full_name: fullName,
    date_of_birth: dob, // required by your schema
    transfermarkt_player_id: tmId,
    transfermarkt_url: tmUrl,
    image_url: img,
    main_position: mainPosition,
    current_club_name: clubName,
    current_club_country: clubCountry,
    last_synced_at: new Date().toISOString(),
    tm_sync_status: "ok",
    tm_sync_error: null,
  }

  // If TM id exists in DB → update, else insert
  let playerId: string | null = null
  let imported = 0
  let matched = 0

  if (tmId) {
    const { data: existing, error: selErr } = await supabase
      .from("players")
      .select("id")
      .eq("transfermarkt_player_id", tmId)
      .maybeSingle()

    if (selErr) return { error: selErr.message }

    if (existing?.id) {
      const { error: upErr } = await supabase.from("players").update(mapped).eq("id", existing.id)
      if (upErr) return { error: upErr.message }
      playerId = existing.id
      matched = 1
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("players")
        .insert(mapped)
        .select("id")
        .single()
      if (insErr) return { error: insErr.message }
      playerId = ins?.id ?? null
      imported = 1
    }
  } else {
    // no TM id → try insert (may create duplicates if used repeatedly)
    const { data: ins, error: insErr } = await supabase
      .from("players")
      .insert(mapped)
      .select("id")
      .single()
    if (insErr) return { error: insErr.message }
    playerId = ins?.id ?? null
    imported = 1
  }

  // Save raw snapshot to external_profiles for audit
  if (playerId) {
    await supabase.from("external_profiles").insert({
      player_id: playerId,
      source: "transfermarkt",
      external_id: tmId,
      profile_url: tmUrl,
      raw: profile,
    }).catch(() => {})
  }

  // Return a slim row for UI
  const { data: updated } = await supabase
    .from("players")
    .select("id, full_name, image_url, transfermarkt_url, main_position, current_club_name, current_club_country")
    .eq("id", playerId)
    .maybeSingle()

  return { imported, matched, player: updated ?? null }
}

async function handle(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 })

  // Accept both GET and POST
  let body: any = {}
  try { body = await req.json() } catch {}
  const url = new URL(req.url)
  const q = String(body?.q ?? url.searchParams.get("q") ?? "").trim()
  const tmIdFromBody = String(body?.tm_id ?? "").trim()
  const page = Number(body?.page ?? url.searchParams.get("page") ?? 1) || 1

  try {
    let profile: any
    let candidate: SearchResult | undefined

    if (tmIdFromBody) {
      // Import directly by TM id
      profile = await tmGetProfile(tmIdFromBody)
    } else {
      if (!q) return NextResponse.json({ error: "Missing 'q' (player name)" }, { status: 400 })
      const res = await tmSearchPlayers(q, page)
      const results = Array.isArray(res?.results) ? res.results : []
      if (!results.length) {
        return NextResponse.json({ imported: 0, matched: 0, player: null })
      }
      candidate = pickCandidate(results, q)
      const tmId = String(candidate?.id ?? "")
      if (!tmId) return NextResponse.json({ error: "No candidate id" }, { status: 400 })
      profile = await tmGetProfile(tmId)
    }

    await sleep(350) // be gentle to the scraper

    const outcome = await upsertPlayerFromProfile(supabase, profile, candidate)
    if ((outcome as any).error) {
      return NextResponse.json(outcome, { status: 400 })
    }
    return NextResponse.json(outcome)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Import failed" }, { status: 502 })
  }
}

export async function POST(req: Request) { return handle(req) }
export async function GET(req: Request)  { return handle(req) }
