// src/app/scout/players/page.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function ScoutPlayersPage() {
  const supabase = await createClient() // ✅ await
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/") // or /login

  const { data: entries, error } = await supabase
    .from("scout_player_entries")
    .select("id, full_name, date_of_birth, main_position, current_club_name, status, image_url, created_at")
    .eq("scout_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return <div className="text-sm text-red-600">Error: {error.message}</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">My Players</h1>
      <div className="grid gap-3">
        {(entries ?? []).map((e) => (
          <div key={e.id} className="border rounded-lg p-4 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={e.image_url || "/placeholder.svg"}
              alt={e.full_name}
              className="h-16 w-16 rounded-md object-cover border"
            />
            <div>
              <div className="font-medium">{e.full_name}</div>
              <div className="text-sm text-muted-foreground">
                DoB: {e.date_of_birth} · Pos: {e.main_position ?? "—"} · Club: {e.current_club_name ?? "—"} · Status: {e.status}
              </div>
            </div>
          </div>
        ))}
        {!entries?.length && <div className="text-sm text-muted-foreground">No players yet.</div>}
      </div>
    </div>
  )
}
