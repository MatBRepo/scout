import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const q = url.searchParams.get("q")?.trim() ?? ""
  const roleParam = url.searchParams.get("role")
  const role: "scout" | "admin" | null =
    roleParam === "scout" || roleParam === "admin" ? roleParam : null

  let query = supabase
    .from("profiles")
    .select("id, full_name, avatar_url, country, agency, role, is_active, created_at")
    .order("created_at", { ascending: false })

  if (q) query = query.or(`full_name.ilike.%${q}%,agency.ilike.%${q}%,country.ilike.%${q}%`)
  if (role) query = query.eq("role", role) // only filter when role is scout/admin

  const { data: profiles, error: pErr } = await query
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 })

  const [{ data: links }, { data: entries }] = await Promise.all([
    supabase.from("players_scouts").select("scout_id"),
    supabase.from("scout_player_entries").select("scout_id"),
  ])

  const myPlayersCount: Record<string, number> = {}
  for (const r of links ?? []) myPlayersCount[r.scout_id] = (myPlayersCount[r.scout_id] ?? 0) + 1

  const entriesCount: Record<string, number> = {}
  for (const r of entries ?? []) entriesCount[r.scout_id] = (entriesCount[r.scout_id] ?? 0) + 1

  const scouts = (profiles ?? []).map(p => ({
    ...p,
    myPlayersCount: myPlayersCount[p.id] ?? 0,
    entriesCount: entriesCount[p.id] ?? 0,
  }))

  return NextResponse.json({ scouts })
}
