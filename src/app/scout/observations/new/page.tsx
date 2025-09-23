"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/browser"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { CalendarDays, Save } from "lucide-react"

export default function NewObservation() {
  const supabase = createClient()
  const router = useRouter()
  const [isPending, start] = useTransition()

  const [title, setTitle] = useState("")
  const [matchDate, setMatchDate] = useState("")
  const [competition, setCompetition] = useState("")
  const [opponent, setOpponent] = useState("")
  const [location, setLocation] = useState("")

  const submit = () => {
    if (!matchDate) return toast.error("Match date is required")
    start(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/auth?redirect_to=/scout/observations/new"); return }
      const { data, error } = await supabase.from("observation_sessions").insert({
        scout_id: user.id,
        title: title || null,
        match_date: matchDate,
        competition: competition || null,
        opponent: opponent || null,
        location: location || null,
      }).select("id").single()
      if (error) return toast.error(error.message)
      toast.success("Observation created")
      router.push(`/scout/observations/${data.id}`)
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">New observation</h1>
      <Card className="p-6 grid gap-4">
        <div className="grid gap-2">
          <Label>Title (optional)</Label>
          <Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="U19 Cup — Semi-final" />
        </div>
        <div className="grid gap-2">
          <Label>Match date *</Label>
          <Input type="date" value={matchDate} onChange={e=>setMatchDate(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Competition</Label>
          <Input value={competition} onChange={e=>setCompetition(e.target.value)} placeholder="Ekstraklasa, U17, etc." />
        </div>
        <div className="grid gap-2">
          <Label>Opponent</Label>
          <Input value={opponent} onChange={e=>setOpponent(e.target.value)} placeholder="Opponent team" />
        </div>
        <div className="grid gap-2">
          <Label>Location</Label>
          <Input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Stadium / City" />
        </div>
        <div className="flex gap-2">
          <Button onClick={submit} disabled={isPending || !matchDate} className="gap-2">
            <Save className="h-4 w-4" /> {isPending ? "Saving…" : "Create"}
          </Button>
        </div>
      </Card>
    </div>
  )
}
