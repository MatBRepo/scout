import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import MyPlayersClient from "./MyPlayersClient"

export const dynamic = "force-dynamic"

export type Row = {
  id: string
  full_name: string
  main_position: string | null
  current_club_name: string | null
  current_club_country: string | null
  image_url: string | null
  transfermarkt_url: string | null
}

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?redirect_to=/scout/my-players")

type DbRow = {
  player_id: string
  // Supabase returns nested relations as arrays, even when it's 1:1
  players: Row[]
}

const { data, error } = await supabase
  .from("players_scouts")
  .select(`
    player_id,
    players:players!players_scouts_player_id_fkey (
      id, full_name, main_position, current_club_name, current_club_country, image_url, transfermarkt_url
    )
  `)
  .eq("scout_id", user.id)
  .order("created_at", { ascending: false })


if (error) {
  return <div className="p-4 md:p-8 text-sm text-red-600">Error: {error.message}</div>
}

// pick the first related player row and drop empties
const rows: Row[] = (data ?? []).map((r: any) => r.players?.[0]).filter(Boolean)


  return (
    <div className="">
      <MyPlayersClient rows={rows} />
    </div>
  )
}
