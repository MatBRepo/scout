// src/app/admin/players/[id]/edit/page.tsx
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import AdminPlayerForm from "./form"

export const dynamic = "force-dynamic"

type Params = { id: string }

export default async function AdminPlayerEdit({
  params,
}: {
  params: Promise<Params>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: player, error } = await supabase
    .from("players")
    .select(`
      id, full_name, date_of_birth, main_position,
      current_club_name, current_club_country, current_club_tier,
      transfermarkt_url, image_url
    `)
    .eq("id", id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!player) notFound()

  return <AdminPlayerForm player={player} />
}
