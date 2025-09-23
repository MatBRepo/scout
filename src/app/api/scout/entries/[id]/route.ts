import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const body = await req.json()
  // Allowed fields (extend as needed)
  const allowed = [
    "full_name","date_of_birth","main_position","current_club_name",
    "transfermarkt_url","opinion","image_url","image_path","status"
  ] as const
  const patch: Record<string, any> = {}
  for (const k of allowed) if (k in body) patch[k] = body[k]

  const { error } = await supabase
    .from("scout_player_entries")
    .update(patch)
    .eq("id", params.id)
    // RLS ensures only owner or admin can update; the filter is just targeting the row.
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const { error } = await supabase
    .from("scout_player_entries")
    .delete()
    .eq("id", params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
