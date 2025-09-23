import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import AddToObservation from "./view.client"

export const dynamic = "force-dynamic"

export default async function AddObservationPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: session } = await supabase
    .from("observation_sessions")
    .select("id, scout_id, competition, opponent, match_date")
    .eq("id", id)
    .maybeSingle()

  if (!session) notFound()
  return <AddToObservation observationId={id} session={session} />
}
