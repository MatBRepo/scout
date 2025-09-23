// src/app/scout/observations/voice-notes/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// Build a Supabase client from the user's cookies (RLS-friendly)
function supabaseFromCookies() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {}, // not needed here
        remove() {}, // not needed here
      },
    }
  )
}

/**
 * POST /scout/observations/voice-notes
 * Body: {
 *   observationId: string,
 *   storagePath: string,
 *   durationSec: number,
 *   language?: string,
 *   playerId?: string,
 *   observationPlayerId?: string,
 *   transcript?: string   // <- optional, from browser STT
 * }
 */
// src/app/scout/observations/voice-notes/route.ts (POST only shown)

export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseFromCookies()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) return NextResponse.json({ ok: false, error: "not authenticated" }, { status: 401 })

    const body = await req.json().catch(() => ({} as any))
    const { observationId, storagePath, durationSec, language, playerId, observationPlayerId, transcript } = body ?? {}

    const missing: string[] = []
    if (!observationId) missing.push("observationId")
    if (!storagePath) missing.push("storagePath")
    if (durationSec === undefined || durationSec === null || Number.isNaN(Number(durationSec))) missing.push("durationSec")
    if (missing.length) return NextResponse.json({ ok: false, error: `missing fields: ${missing.join(", ")}` }, { status: 400 })

    const safeDuration = Math.min(Math.max(parseInt(durationSec as any, 10) || 0, 1), 90)
    const cleanedTranscript = (transcript ?? "").toString().trim()

    const insert = {
      observation_id: observationId as string,
      observation_player_id: observationPlayerId ?? null,
      player_id: playerId ?? null,
      scout_id: user.id,
      storage_path: storagePath as string,
      duration_sec: safeDuration,
      language: language ?? null,
      transcript: cleanedTranscript || null,
      status: cleanedTranscript ? ("done" as const) : ("uploaded" as const),
    }

    const { data, error } = await supabase
      .from("observation_voice_notes")
      .insert(insert)
      .select("id")
      .single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, id: data!.id })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "unexpected error" }, { status: 500 })
  }
}


/**
 * GET /scout/observations/voice-notes?observationId=...&playerId=...&observationPlayerId=...
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = supabaseFromCookies()
    const url = new URL(req.url)
    const observationId = url.searchParams.get("observationId")
    const playerId = url.searchParams.get("playerId")
    const observationPlayerId = url.searchParams.get("observationPlayerId")

    if (!observationId) {
      return NextResponse.json(
        { ok: false, error: "missing fields: observationId" },
        { status: 400 }
      )
    }

    let query = supabase
      .from("observation_voice_notes")
      .select(
        "id, observation_id, observation_player_id, player_id, scout_id, storage_path, duration_sec, language, transcript, status, created_at"
      )
      .eq("observation_id", observationId)
      .order("created_at", { ascending: false })

    if (playerId) query = query.eq("player_id", playerId)
    if (observationPlayerId) query = query.eq("observation_player_id", observationPlayerId)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true, notes: data })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "unexpected error" },
      { status: 500 }
    )
  }
}
