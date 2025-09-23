import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const isUuid = (s?: string | null) =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)

async function readPlayerId(req: Request) {
  const url = new URL(req.url)
  let id = url.searchParams.get("player_id")
  if (!id) {
    // accept JSON body too
    const body = await req.clone().json().catch(() => ({} as any))
    id = body?.player_id
  }
  return id
}

export async function GET(req: Request) {
  // DEBUG helper: confirms what the server sees
  return NextResponse.json({ debug: true, player_id: await readPlayerId(req) })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const player_id = await readPlayerId(req)
  if (!isUuid(player_id)) {
    return NextResponse.json(
      { error: "invalid_player_id", got: player_id ?? null },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from("players_scouts")
    .insert({ player_id, scout_id: user.id })

  if (error) {
    if ((error as any).code === "23505") return NextResponse.json({ ok: true }) // already linked
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true, player_id })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const player_id = await readPlayerId(req)
  if (!isUuid(player_id)) {
    return NextResponse.json(
      { error: "invalid_player_id", got: player_id ?? null },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from("players_scouts")
    .delete()
    .eq("player_id", player_id)
    .eq("scout_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, player_id })
}
