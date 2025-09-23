import { createClient } from "@/lib/supabase/server"

export default async function WithoutAgentPage() {
  const supabase = await createClient() // sync, server-safe

  const { data, error } = await supabase
    .from("v_discover_players")
    .select("id, full_name, date_of_birth, main_position, country_of_birth, agency, transfermarkt_player_id")
    .eq("has_agent", false)
    .order("full_name", { ascending: true })

  if (error) return <div className="p-4 text-red-500">Error: {error.message}</div>

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold">Players without agent</h1>
      <ul className="space-y-2">
        {data?.map(p => (
          <li key={p.id} className="rounded border p-3">
            <div className="font-medium">{p.full_name}</div>
            <div className="text-sm text-muted-foreground">
              {p.main_position} • {p.country_of_birth}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
