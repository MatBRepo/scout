"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/browser"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Mic, Square, Loader2 } from "lucide-react"

type Props = {
  observationId: string
  playerId?: string
  observationPlayerId?: string
  languageHint?: string   // e.g. "pl"
  onSaved?: () => void    // tell parent to refresh lists
}

const MAX_SECONDS = 60

export default function VoiceNoteRecorder({
  observationId, playerId, observationPlayerId, languageHint, onSaved,
}: Props) {
  const supabase = createClient()
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [saving, setSaving] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<number | null>(null)

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" })
      chunksRef.current = []
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data)
      rec.onstop = () => stream.getTracks().forEach(t => t.stop())
      rec.start(250)

      mediaRecorderRef.current = rec
      setRecording(true)
      setSeconds(0)

      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stopAndSave()
          return s + 1
        })
      }, 1000)
    } catch (e: any) {
      toast.error(e?.message || "Microphone error")
    }
  }

  async function stopAndSave() {
    if (!mediaRecorderRef.current) return
    if (mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop()
    setRecording(false)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }

    try {
      if (!chunksRef.current.length) return
      setSaving(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const file = new Blob(chunksRef.current, { type: "audio/webm" })
      const filename = `${crypto.randomUUID()}.webm`
      const path = `${user.id}/${observationId}/${filename}`

      // Upload to Storage (obs-audio)
      const { error: upErr } = await supabase
        .storage.from("obs-audio")
        .upload(path, file, { cacheControl: "3600", contentType: "audio/webm", upsert: false })
      if (upErr) throw upErr

      // Create DB row + (optionally) server transcription
      const resp = await fetch(`/scout/observations/(api)/voice-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observationId,
          observationPlayerId,
          playerId,
          storagePath: path,
          durationSec: seconds,
          language: languageHint,
        }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Failed to create voice note")

      toast.success("Voice note saved")
      setSeconds(0)
      chunksRef.current = []
      onSaved?.()
    } catch (e: any) {
      toast.error(e?.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => () => { // cleanup on unmount
    try { mediaRecorderRef.current?.stop() } catch {}
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const toggle = () => (recording ? stopAndSave() : start())

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        size="sm"
        className="h-8 px-2 gap-1"
        onClick={toggle}
        disabled={saving}
        title={recording ? "Stop & save" : "Start recording"}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> :
         recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {saving ? "Saving" : recording ? "Stop" : "Start"}
      </Button>
      <span className="text-xs tabular-nums text-muted-foreground w-[42px] text-right">
        {seconds}s
      </span>
    </div>
  )
}
