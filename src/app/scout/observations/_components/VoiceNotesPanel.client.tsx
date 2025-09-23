// src/app/scout/observations/_components/VoiceNotesPanel.client.tsx
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/browser"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, FileText, Trash2, RotateCcw } from "lucide-react"
import { toast } from "sonner"

type Note = {
  id: string
  created_at: string
  status: string | null
  transcript: string | null
  storage_path: string
  duration_sec: number | null
}

type Props = {
  observationId: string
  playerId?: string
  observationPlayerId?: string
  languageHint?: string
  title?: string
}

// Control whether server-side transcription is available.
// Do NOT expose your OpenAI key to the client;
// instead, set NEXT_PUBLIC_CAN_SERVER_TRANSCRIBE=1 if you've configured server transcription.
const CAN_SERVER_TRANSCRIBE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_CAN_SERVER_TRANSCRIBE === "1"

export default function VoiceNotesPanel({
  observationId,
  playerId,
  observationPlayerId,
  languageHint = "pl",
  title = "Voice notes",
}: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<(Note & { url?: string })[]>([])

  async function fetchList() {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ observationId })
      if (playerId) qs.set("playerId", playerId)
      if (observationPlayerId) qs.set("observationPlayerId", observationPlayerId)

      const r = await fetch(`/scout/observations/voice-notes?` + qs.toString())
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || "Failed to load")

      const signed = await Promise.all(
        (j.notes as Note[]).map(async (n) => {
          const { data: s } = await supabase.storage.from("obs-audio").createSignedUrl(n.storage_path, 600)
          return { ...n, url: s?.signedUrl }
        })
      )
      setItems(signed)
    } catch (e: any) {
      toast.error(e?.message || "Failed to load notes")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observationId, playerId, observationPlayerId])

  async function onDelete(id: string) {
    if (!confirm("Delete this voice note?")) return
    const r = await fetch(`/scout/observations/voice-notes/${id}`, { method: "DELETE" })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || !j.ok) return toast.error(j.error || "Delete failed")
    toast.success("Deleted")
    setItems((arr) => arr.filter((x) => x.id !== id))
  }

  async function onRetranscribe(id: string) {
    if (!CAN_SERVER_TRANSCRIBE) {
      return toast.info("Server transcription is disabled.")
    }
    const r = await fetch(`/scout/observations/voice-notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "transcribe", language: languageHint }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || !j.ok) return toast.error(j.error || "Transcription failed")
    toast.success("Transcribed")
    setItems((arr) => arr.map((x) => (x.id === id ? { ...x, transcript: j.transcript, status: "done" } : x)))
  }

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-4 w-4" />
        <div className="font-medium">{title}</div>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={fetchList}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground">No voice notes yet.</div>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.id} className="rounded-lg border p-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()} • {n.duration_sec ?? "—"}s • {n.status ?? "—"}
                </div>
                {n.url ? <audio controls preload="none" src={n.url} className="w-full sm:w-80" /> : null}
              </div>

              {n.transcript ? (
                <div className="mt-2 text-sm whitespace-pre-wrap">{n.transcript}</div>
              ) : (
                <div className="mt-2 text-xs text-muted-foreground">No transcript yet.</div>
              )}

              <div className="mt-2 flex gap-2">
                {CAN_SERVER_TRANSCRIBE && (
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => onRetranscribe(n.id)}>
                    <RotateCcw className="h-4 w-4" /> Transcribe
                  </Button>
                )}
                <Button size="sm" variant="destructive" className="gap-2" onClick={() => onDelete(n.id)}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
