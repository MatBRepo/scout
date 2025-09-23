// src/app/api/scout/players/[id]/follow/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type RouteParams = { id?: string }
type Ctx = { params: Promise<RouteParams> }

// tiny helper to safely extract the id even if params is missing
function getId(req: Request, params?: RouteParams) {
  const fromParams = params?.id?.trim()
  if (fromParams) return fromParams
  const parts = new URL(req.url).pathname.split("/").filter(Boolean)
  // .../api/scout/players/:id/follow -> id is the penultimate segment
  return parts.length >= 5 ? parts[parts.length - 2] : undefined
}

const isUuid = (s?: string) =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)

export async function GET(req: Request, ctx: Ctx) {
  const p = await ctx.params
  const id = getId(req, p)
  return NextResponse.json({
    ok: true,
    idFromParams: p?.id ?? null,
    idFromPath: id ?? null,
  })
}

export async function POST(req: Request, ctx: Ctx) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const p = await ctx.params
  const id = getId(req, p)
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid_player_id", got: id ?? null }, { status: 400 })
  }

  const { error } = await supabase
    .from("players_scouts")
    .insert({ player_id: id, scout_id: user.id })

  if (error) {
    const pgErr = error as { code?: string; message: string }
    // Ignore duplicate key errors so the action is idempotent
    if (pgErr.code === "23505") return NextResponse.json({ ok: true })
    return NextResponse.json({ error: pgErr.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, ctx: Ctx) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const p = await ctx.params
  const id = getId(req, p)
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid_player_id", got: id ?? null }, { status: 400 })
  }

  const { error } = await supabase
    .from("players_scouts")
    .delete()
    .eq("player_id", id)
    .eq("scout_id", user.id)

  if (error) return NextResponse.json({ error: (error as any).message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
