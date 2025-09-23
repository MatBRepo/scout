export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0
export const maxDuration = 300

import { NextResponse } from "next/server"
// (reuse the same helpers / parsers from the stream route)
import * as cheerio from "cheerio"
import { createClient } from "@supabase/supabase-js"

// … copy the same helper functions here (fetchHtml, parse*, upsert) …

export async function POST(req: Request) {
  const { country = "135", season = 2025 } = await req.json().catch(() => ({}))
  try {
    // identical logic: competitions -> clubs -> players (no streaming)
    // return final counts
    return NextResponse.json({ ok: true, competitions: nComp, clubs: nClubs, players: nPlayers })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 })
  }
}
