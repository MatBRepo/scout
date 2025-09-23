import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import ObservationsTable from "./_components/ObservationsTable.client"

export const dynamic = "force-dynamic"

export default async function ObservationsIndex() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth?redirect_to=/scout/observations")

  // Load sessions with a cheap players count
  const { data, error } = await supabase
    .from("observation_sessions")
    .select(`
      id,
      title,
      match_date,
      competition,
      opponent,
      observation_players(count)
    `)
    .eq("scout_id", user.id)
    .order("match_date", { ascending: false })

  if (error) {
    return (
      <Card className="p-4 border-destructive/30">
        <div className="text-sm text-red-600">Error: {error.message}</div>
      </Card>
    )
  }

  const rows = (data ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    match_date: r.match_date,          // YYYY-MM-DD
    competition: r.competition,
    opponent: r.opponent,
    players_count: r.observation_players?.[0]?.count ?? 0,
  }))

  return <ObservationsTable initialRows={rows} />
}
