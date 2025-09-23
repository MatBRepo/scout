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
  // params comes as a Promise in the App Router; await it before using
  params: Promise<{ id: string }>
}

export default async function ObservationDetail({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth?redirect_to=/scout/observations/${id}`)

  // Load session + players
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
          {/* quick count is optional; editor shows details anyway */}
          <div className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Players
          </div>
        </div>
      </div>

      {/* Main editor */}
      <ObservationEditor session={obs} rows={list ?? []} />
    </div>
  )
}
