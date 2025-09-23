// src/app/api/scout/discover/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type SortKey = "newest" | "name" | "interest"

export async function GET(req: Request) {
  try {
    const supabase = await createClient() // ← MUST await (Next 15)
    const { data: { user } } = await supabase.auth.getUser()

    const url = new URL(req.url)
    const search  = (url.searchParams.get("search") || "").trim()
    const position= url.searchParams.get("position") || "" // "any" or real code; empty ⇒ no filter
    const country = (url.searchParams.get("country") || "").trim()
    const sort    = (url.searchParams.get("sort") as SortKey) || "newest"
    const page    = Math.max(1, Number(url.searchParams.get("page") || 1))
    const limit   = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 24)))
    const from    = (page - 1) * limit
    const to      = from + limit - 1

    // Build players query
    let q = supabase
      .from("players")
      .select("id, full_name, main_position, current_club_name, current_club_country, image_url, transfermarkt_url, created_at")

    if (search)   q = q.ilike("full_name", `%${search}%`)
    if (position && position !== "any") q = q.eq("main_position", position)
    if (country)  q = q.ilike("current_club_country", `%${country}%`)

    if (sort === "name") q = q.order("full_name", { ascending: true })
    else                 q = q.order("created_at", { ascending: false }) // default newest

    q = q.range(from, to)

    const { data: players, error } = await q
    if (error) {
      // Return the real cause to the client so you can see it in the toast
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const ids = (players ?? []).map(p => p.id)
    const following: Record<string, boolean> = {}
    const interest: Record<string, number> = {}

    if (ids.length) {
      // RLS may restrict to the current user; that's OK (interest falls back to “own”)
      const { data: links, error: linksErr } = await supabase
        .from("players_scouts")
        .select("player_id, scout_id")
        .in("player_id", ids)

      if (!linksErr && links) {
        for (const row of links) {
          interest[row.player_id] = (interest[row.player_id] ?? 0) + 1
          if (user && row.scout_id === user.id) following[row.player_id] = true
        }
      }
    }

    return NextResponse.json({
      players: (players ?? []).map(p => ({
        id: p.id,
        full_name: p.full_name,
        main_position: p.main_position,
        current_club_name: p.current_club_name,
        current_club_country: p.current_club_country,
        image_url: p.image_url,
        transfermarkt_url: p.transfermarkt_url,
      })),
      following,
      interest,
    })
  } catch (e: any) {
    // Catch unexpected errors (e.g., forgot to await, env misconfig, etc.)
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 })
  }
}
