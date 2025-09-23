import { createClient } from "@/lib/supabase/server"
import AdminPlayerForm from "./form"

export default async function AdminPlayerEdit({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: player, error } = await supabase
    .from("players")
    .select("id, full_name, date_of_birth, main_position, current_club_name, current_club_country, current_club_tier, transfermarkt_url, image_url")
    .eq("id", params.id)
    .single()
  if (error) throw new Error(error.message)
  return <AdminPlayerForm player={player} />
}
