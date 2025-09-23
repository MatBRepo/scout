// src/app/scout/observations/[id]/page.tsx
import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, CalendarDays, Users } from "lucide-react"
import ObservationEditor from "./view.client"
import VoiceNoteRecorder from "../_components/VoiceNoteRecorder.client"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ObservationDetail({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth?redirect_to=/scout/observations/${id}`)

  const [{ data: obs }, { data: list }] = await Promise.all([
    supabase
      .from("observation_sessions")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("observation_players")
      .select(`
        id, observation_id, player_id, player_entry_id,
        minutes_watched, rating, notes,
        players ( id, full_name, image_url, transfermarkt_url ),
        scout_player_entries ( id, full_name, image_url, transfermarkt_url )
      `)
      .eq("observation_id", id)
      .order("created_at", { ascending: false }),
  ])

  if (!obs) {
    return (
      <Card className="p-4">
        <div className="mb-3">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link href="/scout/observations">
              <ArrowLeft className="h-4 w-4" />
              Back to Observations
            </Link>
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">Observation not found.</div>
      </Card>
    )
  }

  // --- Normalize nested arrays -> single object (or null) ---
  type RawRow = {
    id: string
    observation_id: string
    player_id: string | null
    player_entry_id: string | null
    minutes_watched: number | null
    rating: number | null
    notes: string | null
    players: { id: string; full_name: string; image_url: string | null; transfermarkt_url: string | null }[] | null
    scout_player_entries: { id: string; full_name: string; image_url: string | null; transfermarkt_url: string | null }[] | null
  }

  const rows = ((list ?? []) as RawRow[]).map(r => ({
    ...r,
    players: r.players?.[0] ?? null,
    scout_player_entries: r.scout_player_entries?.[0] ?? null,
  }))

  return (
    <div className="space-y-4">
      {/* Top bar: back button + quick meta */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link href="/scout/observations">
              <ArrowLeft className="h-4 w-4" />
              Back to Observations
            </Link>
          </Button>
          <div className="hidden sm:block text-sm font-medium truncate">
            {obs.title || obs.competition || "Observation"}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {obs.match_date || "—"}
            {obs.opponent ? ` • vs ${obs.opponent}` : ""}
          </div>
          <div className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Players
          </div>
        </div>
      </div>

      <ObservationEditor session={obs} rows={rows} />
    </div>
  )
}
