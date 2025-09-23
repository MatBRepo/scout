import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type Params = { id: string }
type Ctx = { params: Promise<Params> }

const isUuid = (s?: string) =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  return NextResponse.json({ ok: true, id })
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ error: "invalid_player_id", got: id }, { status: 400 })

  const { error } = await supabase
    .from("players_scouts")
    .insert({ player_id: id, scout_id: user.id })

  // Make it idempotent: ignore unique-violation
  if (error && (error as any).code !== "23505") {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ error: "invalid_player_id", got: id }, { status: 400 })

  const { error } = await supabase
    .from("players_scouts")
    .delete()
    .eq("player_id", id)
    .eq("scout_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
