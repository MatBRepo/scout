// src/app/scout/observations/[id]/view.client.tsx
"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/browser"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import { SlidersHorizontal, ChevronDown } from "lucide-react"

import {
  Plus, Save, Trash2, CalendarDays, Users, Search, Loader2,
  ExternalLink, Mic, Square, FileText, Star, Tv, Binoculars
} from "lucide-react"
import VoiceNotesPanel from "../_components/VoiceNotesPanel.client"




type Session = {
  id: string
  scout_id: string
  title: string | null
  match_date: string | null
  competition: string | null
  opponent: string | null
  notes: string | null
  mode?: "live" | "video" | null
}

type Row = {
  id: string
  observation_id: string
  player_id: string | null
  player_entry_id: string | null
  minutes_watched: number | null
  rating: number | null // 1–5
  offense_rating?: number | null
  defense_rating?: number | null
  technique_rating?: number | null
  motor_rating?: number | null
  notes: string | null
  players?: { id: string; full_name: string; image_url: string | null; transfermarkt_url: string | null } | null
  scout_player_entries?: { id: string; full_name: string; image_url: string | null; transfermarkt_url: string | null } | null
}

type Props = { session: Session; rows: Row[] }

const FALLBACK_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="#e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="10" fill="#9ca3af">No Img</text></svg>'
  )

const LANGUAGE = "pl"
const MAX_SECONDS = 60

/* ---------------- Small UI helpers ---------------- */

function ModeBadge({ mode }: { mode: "live" | "video" }) {
  if (mode === "video") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Tv className="h-3.5 w-3.5" />
        Video
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Binoculars className="h-3.5 w-3.5" />
      Live
    </span>
  )
}

function Rate5({
  value = 0,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  value?: number | null
  onChange: (val: number) => void
  disabled?: boolean
  ariaLabel?: string
}) {
  const v = Math.max(0, Math.min(5, Number(value || 0)))
  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label={ariaLabel}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= v
        return (
          <button
            type="button"
            key={n}
            onClick={() => !disabled && onChange(n)}
            className={`h-7 w-7 grid place-items-center rounded-md transition
              ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            role="radio"
            aria-checked={active}
            aria-label={`${n} / 5`}
          >
            <Star className="h-4 w-4" fill={active ? "currentColor" : "none"} />
          </button>
        )
      })}
    </div>
  )
}

/* ===================================================== */

export default function ObservationEditor({ session: initial, rows: initialRows }: Props) {
  const supabase = createClient()

  /** ---------------- Session meta (autosave + mode toggle) ---------------- */
  const [session, setSession] = useState<Session>(initial)
  const [savingMeta, setSavingMeta] = useState(false)
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onMetaChange = <K extends keyof Session>(key: K, val: Session[K]) => {
    setSession((s) => ({ ...s, [key]: val }))
    if (metaTimer.current) clearTimeout(metaTimer.current)
    metaTimer.current = setTimeout(async () => {
      setSavingMeta(true)
      try {
        const patch: Partial<Session> = { [key]: val }
        const { error } = await supabase
          .from("observation_sessions")
          .update(patch)
          .eq("id", initial.id)
          .select("id")
          .maybeSingle()
        if (error) throw error
      } catch (e: any) {
        toast.error(e?.message || "Failed to save")
      } finally {
        setSavingMeta(false)
      }
    }, 400)
  }

  const onToggleMode = async (isLive: boolean) => {
    const next: "live" | "video" = isLive ? "live" : "video"
    setSession((s) => ({ ...s, mode: next }))
    setSavingMeta(true)
    try {
      const { error } = await supabase
        .from("observation_sessions")
        .update({ mode: next })
        .eq("id", initial.id)
        .select("id")
        .maybeSingle()
      if (error) throw error
    } catch (e: any) {
      toast.error(e?.message || "Could not update mode")
      setSession((s) => ({ ...s, mode: s.mode === "live" ? "video" : "live" }))
    } finally {
      setSavingMeta(false)
    }
  }

  /** ---------------- Player rows (minimal styling) ---------------- */
  const [rows, setRows] = useState<Row[]>(initialRows)

  type Draft = Pick<
    Row,
    "minutes_watched" | "rating" | "notes" | "offense_rating" | "defense_rating" | "technique_rating" | "motor_rating"
  >
  const [dirty, setDirty] = useState<Record<string, Draft>>({})
  const [savingRow, setSavingRow] = useState<Record<string, boolean>>({})

  const setRowDraft = (id: string, patch: Partial<Draft>) => {
    setDirty((d) => ({ ...d, [id]: { ...d[id], ...patch } }))
  }
  const showRowSave = (id: string) => !!dirty[id]

  const saveRow = async (id: string) => {
    const patch = dirty[id]
    if (!patch) return
    setSavingRow((s) => ({ ...s, [id]: true }))
    try {
      const body: Record<string, any> = {}
      ;(["minutes_watched", "rating", "notes", "offense_rating", "defense_rating", "technique_rating", "motor_rating"] as const)
        .forEach((k) => {
          const next = (patch as any)[k]
          if (next !== undefined) body[k] = next
        })

      const r = await fetch(`/scout/observations/players/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || "Save failed")

      setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...body } : row)))
      setDirty((d) => {
        const { [id]: _, ...rest } = d
        return rest
      })
      toast.success("Zapisano")
    } catch (e: any) {
      toast.error(e?.message || "Save failed")
    } finally {
      setSavingRow((s) => ({ ...s, [id]: false }))
    }
  }

  const deleteRow = async (id: string) => {
    if (!confirm("Remove player from this observation?")) return
    setSavingRow((s) => ({ ...s, [id]: true }))
    try {
      const r = await fetch(`/scout/observations/players/${id}`, { method: "DELETE" })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || "Delete failed")
      setRows((prev) => prev.filter((row) => row.id !== id))
      setDirty((d) => {
        const { [id]: _, ...rest } = d
        return rest
      })
      // prune voice counters for this row if present
      setVoiceCountsByRow((m) => {
        const n = { ...m }
        if (n[id]) {
          setVoiceTotal((t) => Math.max(0, t - n[id]))
          delete n[id]
        }
        return n
      })
      toast.success("Usunięto")
    } catch (e: any) {
      toast.error(e?.message || "Delete failed")
    } finally {
      setSavingRow((s) => ({ ...s, [id]: false }))
    }
  }

  /** ---------------- Search + Quick Add Player ---------------- */
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<
    { type: "player" | "entry"; id: string; full_name: string; image_url: string | null; tm?: string | null }[]
  >([])

  const [quickOpen, setQuickOpen] = useState(false)
  const [quickForm, setQuickForm] = useState({
    full_name: "",
    date_of_birth: "",
    main_position: "",
    dominant_foot: "" as "" | "left" | "right" | "both",
    country_of_birth: "",
  })
  const [quickBusy, setQuickBusy] = useState(false)

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = query.trim()
      if (!q) {
        setResults([])
        return
      }
      setSearching(true)
      try {
        const [p1, p2] = await Promise.all([
          supabase
            .from("players")
            .select("id, full_name, image_url, transfermarkt_url")
            .ilike("full_name", `%${q}%`)
            .limit(10),
          supabase
            .from("scout_player_entries")
            .select("id, full_name, image_url, transfermarkt_url")
            .ilike("full_name", `%${q}%`)
            .limit(10),
        ])
        const A =
          (p1.data || []).map((p) => ({
            type: "player" as const,
            id: p.id,
            full_name: p.full_name,
            image_url: p.image_url,
            tm: (p as any).transfermarkt_url || null,
          })) ?? []
        const B =
          (p2.data || []).map((p) => ({
            type: "entry" as const,
            id: p.id,
            full_name: p.full_name,
            image_url: p.image_url,
            tm: (p as any).transfermarkt_url || null,
          })) ?? []
        const seen = new Set<string>()
        const merged = [...A, ...B].filter((r) => {
          const k = `${r.type}:${r.id}`
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
        setResults(merged)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const alreadyInList = (rec: { type: "player" | "entry"; id: string }) =>
    rows.some((r) => (rec.type === "player" ? r.player_id === rec.id : r.player_entry_id === rec.id))

  const addToObservation = async (rec: { type: "player" | "entry"; id: string }) => {
    if (alreadyInList(rec)) {
      toast.message("Already added", { description: "This player is already in this observation." })
      return
    }
    try {
      const payload = rec.type === "player" ? { player_id: rec.id } : { player_entry_id: rec.id }
      const r = await fetch(`/scout/observations/${session.id}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || "Add failed")
      const newRow: Row =
        j?.row ?? {
          id: crypto.randomUUID(),
          observation_id: session.id,
          player_id: payload.player_id ?? null,
          player_entry_id: payload.player_entry_id ?? null,
          minutes_watched: 0,
          rating: null,
          notes: "",
          players: undefined,
          scout_player_entries: undefined,
        }
      setRows((prev) => [newRow, ...prev])
      toast.success("Dodano do obserwacji")
      setQuery("")
      setResults([])
    } catch (e: any) {
      toast.error(e?.message || "Add failed")
    }
  }

  const createQuickPlayer = async () => {
    if (!quickForm.full_name.trim() || !quickForm.date_of_birth) {
      toast.error("Full name and date of birth are required")
      return
    }
    setQuickBusy(true)
    try {
      const uid = (await supabase.auth.getUser()).data.user?.id
      if (!uid) throw new Error("Not authenticated")

      const { data: player, error } = await supabase
        .from("players")
        .insert({
          full_name: quickForm.full_name.trim(),
          date_of_birth: quickForm.date_of_birth,
          main_position: quickForm.main_position || null,
          dominant_foot: quickForm.dominant_foot || null,
          country_of_birth: quickForm.country_of_birth || null,
          created_by: uid,
        })
        .select("id, full_name, image_url")
        .single()
      if (error) throw error

      // attach to my players
      await supabase.from("players_scouts").insert({
        player_id: player.id,
        scout_id: uid,
      }).catch(() => {})

      // immediately add to this observation
      await addToObservation({ type: "player", id: player.id })

      setQuickForm({
        full_name: "",
        date_of_birth: "",
        main_position: "",
        dominant_foot: "",
        country_of_birth: "",
      })
      setQuickOpen(false)
      toast.success("Player created")
    } catch (e: any) {
      toast.error(e?.message || "Could not create player")
    } finally {
      setQuickBusy(false)
    }
  }

  /** ---------------- Voice note counts ---------------- */
  const [voiceCountsByRow, setVoiceCountsByRow] = useState<Record<string, number>>({})
  const [voiceTotal, setVoiceTotal] = useState(0)
  const [voiceObsLevel, setVoiceObsLevel] = useState(0)

  const loadVoiceCounts = async () => {
    const { data, error } = await supabase
      .from("observation_voice_notes")
      .select("id, observation_player_id")
      .eq("observation_id", session.id)

    if (error) {
      console.warn("voice counts error:", error.message)
      return
    }
    const map: Record<string, number> = {}
    let obsLevel = 0
    for (const v of data || []) {
      if (v.observation_player_id) {
        map[v.observation_player_id] = (map[v.observation_player_id] || 0) + 1
      } else {
        obsLevel += 1
      }
    }
    setVoiceCountsByRow(map)
    setVoiceObsLevel(obsLevel)
    setVoiceTotal((data || []).length)
  }

  useEffect(() => {
    loadVoiceCounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id])

  const bumpVoiceCounts = (opts: { observationPlayerId?: string }) => {
    setVoiceTotal((t) => t + 1)
    if (opts.observationPlayerId) {
      setVoiceCountsByRow((m) => ({ ...m, [opts.observationPlayerId!]: (m[opts.observationPlayerId!] || 0) + 1 }))
    } else {
      setVoiceObsLevel((n) => n + 1)
    }
  }

  /** ---------------- Text notes count ---------------- */
  const textNotesCount = useMemo(() => {
    const sessionNote = session.notes && session.notes.trim() ? 1 : 0
    let perRows = 0
    for (const r of rows) {
      const v = (dirty[r.id]?.notes !== undefined ? dirty[r.id]?.notes : r.notes) || ""
      if (String(v).trim()) perRows += 1
    }
    return sessionNote + perRows
  }, [session.notes, rows, dirty])

  /** ---------------- Notes panel toggles ---------------- */
  const [openObsNotes, setOpenObsNotes] = useState(false)
  const [openNotesByRow, setOpenNotesByRow] = useState<Record<string, boolean>>({})
  const toggleRowNotes = (rowId: string, forceOpen?: boolean) =>
    setOpenNotesByRow((s) => ({ ...s, [rowId]: forceOpen ?? !s[rowId] }))

  /** ---------------- Keys to refresh voice panels ---------------- */
  const [obsNotesKey, setObsNotesKey] = useState(0)
  const [rowNotesKey, setRowNotesKey] = useState<Record<string, number>>({})
  const bumpRowKey = (rowId: string) =>
    setRowNotesKey((m) => ({ ...m, [rowId]: (m[rowId] || 0) + 1 }))

  /** ---------------- Inline recorder ---------------- */
  function InlineRecorder({
    observationId,
    playerId,
    observationPlayerId,
    onSaved,
  }: {
    observationId: string
    playerId?: string
    observationPlayerId?: string
    onSaved?: () => void
  }) {
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<BlobPart[]>([])
    const [recording, setRecording] = useState(false)
    const [seconds, setSeconds] = useState(0)
    const timerRef = useRef<number | null>(null)
    const [busy, setBusy] = useState(false)

    const recognitionRef = useRef<any>(null)
    const [liveText, setLiveText] = useState("")

    const getSupportedMime = () => {
      // @ts-ignore
      if (typeof MediaRecorder === "undefined") return undefined
      const cands = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]
      // @ts-ignore
      for (const c of cands) if (MediaRecorder.isTypeSupported?.(c)) return c
      return undefined
    }

    const startRecognition = () => {
      try {
        const SR: any =
          (globalThis as any).SpeechRecognition ||
          (globalThis as any).webkitSpeechRecognition
        if (!SR) return
        const rec = new SR()
        rec.lang = LANGUAGE
        rec.continuous = true
        rec.interimResults = true
        rec.onresult = (e: any) => {
          let finalText = ""
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const res = e.results[i]
            if (res.isFinal) finalText += res[0].transcript
          }
          if (finalText) setLiveText((t) => (t ? `${t} ${finalText}` : finalText))
        }
        rec.onerror = (ev: any) => console.warn("SpeechRecognition error:", ev?.error)
        rec.onend = () => { if (recording) { try { rec.start() } catch {} } }
        recognitionRef.current = rec
        rec.start()
      } catch (e) {
        console.warn("SpeechRecognition init failed:", e)
      }
    }

    const stopRecognition = () => {
      try { recognitionRef.current?.stop?.() } catch {}
      recognitionRef.current = null
    }

    const start = async () => {
      try {
        if (!(location.protocol === "https:" || location.hostname === "localhost")) {
          toast.error("Microphone requires HTTPS (or localhost)")
          return
        }
        // @ts-ignore
        if (typeof MediaRecorder === "undefined") {
          toast.error("Recording not supported in this browser")
          return
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        })
        const mime = getSupportedMime()
        const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
        chunksRef.current = []
        rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop())
          void save()
        }
        rec.start(250)
        mediaRecorderRef.current = rec
        setRecording(true)
        setSeconds(0)
        setLiveText("")
        toast.message("Recording…", { description: `Up to ${MAX_SECONDS}s` })
        startRecognition()
        timerRef.current = window.setInterval(() => {
          setSeconds((s) => {
            if (s + 1 >= MAX_SECONDS) stop()
            return s + 1
          })
        }, 1000)
      } catch (e: any) {
        const name = e?.name || ""
        if (name === "NotAllowedError") toast.error("Mic permission denied")
        else if (name === "NotFoundError") toast.error("No microphone found")
        else if (name === "NotReadableError") toast.error("Microphone busy")
        else toast.error(e?.message || "Unable to start")
      }
    }

    const stop = () => {
      try { if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop() } catch {}
      setRecording(false)
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      stopRecognition()
      toast.success("Recording stopped")
    }

    const save = async () => {
      if (!chunksRef.current.length) return
      setBusy(true)
      try {
        const uid = (await supabase.auth.getUser()).data.user?.id
        if (!uid) { toast.error("Not authenticated"); return }
        const voiceId = crypto.randomUUID()
        const mime = mediaRecorderRef.current?.mimeType || "audio/webm"
        const file = new Blob(chunksRef.current, { type: mime })
        const path = `${uid}/${observationId}/${voiceId}.webm`

        const { error: upErr } = await supabase.storage.from("obs-audio").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: mime,
        })
        if (upErr) { toast.error(upErr.message); return }

        const resp = await fetch(`/scout/observations/voice-notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            observationId,
            observationPlayerId,
            playerId,
            storagePath: path,
            durationSec: seconds,
            language: LANGUAGE,
            transcript: liveText?.trim() || undefined,
          }),
        })
        const j = await resp.json().catch(() => ({}))
        if (!resp.ok || !j.ok) { toast.error(j.error || "Failed to save voice note"); return }

        bumpVoiceCounts({ observationPlayerId })
        onSaved?.()
        toast.success(liveText?.trim() ? "Saved with browser transcript" : "Saved")
      } finally {
        setBusy(false)
        chunksRef.current = []
      }
    }

    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          {!recording ? (
            <Button size="sm" onClick={start} className="h-8 px-2" disabled={busy} aria-label="Start recording">
              <Mic className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" variant="destructive" onClick={stop} className="h-8 px-2" aria-label="Stop recording">
              <Square className="h-4 w-4" />
            </Button>
          )}
          {recording && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-ping" aria-hidden="true" />}
        </div>
        <span className={`w-[42px] text-right text-xs tabular-nums ${recording ? "animate-pulse text-red-500" : "text-muted-foreground"}`}>
          {seconds}s
        </span>
      </div>
    )
  }

  /** ---------------- Helpers ---------------- */
  const totalPlayers = rows.length
  const titlePlaceholder =
    session.competition && session.opponent
      ? `${session.competition} • vs ${session.opponent}`
      : "Session title (optional)"
  const formatDate = (d?: string | null) => d || ""
  const rowHasTextNote = (row: Row) => {
    const v = (dirty[row.id]?.notes !== undefined ? dirty[row.id]?.notes : row.notes) || ""
    return Boolean(String(v).trim())
  }

  /* ================================ RENDER ================================ */

  return (
    <div className="space-y-8">
      {/* Header / Meta */}
      <section className="space-y-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <Input
              value={session.title ?? ""}
              onChange={(e) => onMetaChange("title", e.target.value)}
              placeholder={titlePlaceholder}
              className="text-lg font-semibold"
              aria-label="Session title"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Input
                value={formatDate(session.match_date)}
                onChange={(e) => onMetaChange("match_date", e.target.value)}
                placeholder="YYYY-MM-DD"
                type="date"
                aria-label="Match date"
              />
              <Input
                value={session.competition ?? ""}
                onChange={(e) => onMetaChange("competition", e.target.value)}
                placeholder="Competition"
                aria-label="Competition"
              />
              <Input
                value={session.opponent ?? ""}
                onChange={(e) => onMetaChange("opponent", e.target.value)}
                placeholder="Opponent"
                aria-label="Opponent"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Autosave: {savingMeta ? "saving…" : "idle"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {totalPlayers} player{totalPlayers === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1" title="Text notes (session + players)">
                <FileText className="h-3.5 w-3.5" /> {textNotesCount} text
              </span>
              <span className="inline-flex items-center gap-1" title="Voice notes (all)">
                <Mic className="h-3.5 w-3.5" /> {voiceTotal} voice
              </span>
              {session.mode && <ModeBadge mode={(session.mode ?? "live")} />}
            </div>
          </div>

          <div className="lg:w-[420px] space-y-2">
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <div>
                <div className="text-sm font-medium">Tryb obserwacji</div>
                <div className="text-[11px] text-muted-foreground">Live (stadion) / Video (TV/stream)</div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={(session.mode ?? "live") === "live"}
                  onCheckedChange={onToggleMode}
                  aria-label="Toggle observation mode (on = live, off = video)"
                />
                <ModeBadge mode={(session.mode ?? "live")} />
              </div>
            </div>

            <Textarea
              rows={4}
              value={session.notes ?? ""}
              onChange={(e) => onMetaChange("notes", e.target.value)}
              placeholder="Notatki ogólne…"
              aria-label="Observation notes"
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* Observation voice notes (minimal) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Notatki głosowe (obserwacja)</div>
          <div className="flex items-center gap-2">
            <InlineRecorder
              observationId={session.id}
              onSaved={() => {
                setOpenObsNotes(true)
                setObsNotesKey((k) => k + 1)
              }}
            />
            <Button
              size="sm"
              variant={openObsNotes ? "secondary" : "outline"}
              onClick={() => setOpenObsNotes((v) => !v)}
              aria-expanded={openObsNotes}
              aria-controls="obs-voice-panel"
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">
                {openObsNotes ? `Ukryj (${voiceObsLevel})` : `Pokaż (${voiceObsLevel})`}
              </span>
              <span className="sm:hidden tabular-nums">({voiceObsLevel})</span>
            </Button>
          </div>
        </div>

        {openObsNotes && (
          <div id="obs-voice-panel">
            <VoiceNotesPanel key={obsNotesKey} observationId={session.id} title="Notatki głosowe" />
          </div>
        )}
      </section>

      <Separator />

      {/* Add players – search + quick add (no cards) */}
      <section className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              className="pl-8"
              placeholder="Szukaj zawodników, aby dodać…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search players to add"
            />
            {searching && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setQuickOpen(true)}>
            <Plus className="h-4 w-4" />
            Quick add player
          </Button>
        </div>

        {!!results.length && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {results.map((r) => (
              <li
                key={`${r.type}-${r.id}`}
                className="flex items-center justify-between rounded-md bg-muted/30 px-2.5 py-2"
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.image_url || FALLBACK_SVG}
                    alt={r.full_name}
                    className="h-8 w-8 rounded object-cover"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.full_name}</div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded bg-background/60 px-1.5 py-0.5">
                        {r.type === "player" ? "Players" : "Entry"}
                      </span>
                      {r.tm && (
                        <a
                          href={r.tm}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 underline"
                        >
                          TM <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-2"
                  onClick={() => addToObservation(r)}
                  disabled={alreadyInList(r)}
                >
                  <Plus className="h-4 w-4" /> {alreadyInList(r) ? "Added" : "Add"}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {!results.length && query.trim() && !searching && (
          <div className="text-xs text-muted-foreground">Brak wyników.</div>
        )}
      </section>

      <Separator />

      {/* Players list – flat rows, minimal chrome */}
      <section className="space-y-3">
        <div className="hidden grid-cols-[1fr_100px_180px_180px_auto] gap-3 px-1 text-[11px] text-muted-foreground md:grid">
          <span>Zawodnik</span>
          <span className="text-right">Minuty</span>
          <span>Ocena ogólna</span>
          <span>Oceny cząstkowe</span>
          <span className="text-right">Akcje</span>
        </div>

        <div className="space-y-2">
          {rows.map((row) => {
            const p = row.players ?? row.scout_player_entries
            const isSaving = !!savingRow[row.id]
            const isNotesOpen = !!openNotesByRow[row.id]
            const isDirty = !!dirty[row.id]

            const voiceCountForRow = voiceCountsByRow[row.id] || 0
            const textNoteForRow = rowHasTextNote(row) ? 1 : 0

            const currentOverall = (dirty[row.id]?.rating ?? row.rating) ?? 0
            const curOff = (dirty[row.id]?.offense_rating ?? row.offense_rating) ?? 0
            const curDef = (dirty[row.id]?.defense_rating ?? row.defense_rating) ?? 0
            const curTec = (dirty[row.id]?.technique_rating ?? row.technique_rating) ?? 0
            const curMot = (dirty[row.id]?.motor_rating ?? row.motor_rating) ?? 0

            return (
              <div
                key={row.id}
                className={`rounded-md px-2.5 py-2 transition-colors hover:bg-muted/30 ${isDirty ? "bg-amber-50/40 dark:bg-amber-950/20" : ""}`}
              >
                <div className="grid gap-3 md:grid-cols-[1fr_100px_180px_180px_auto] md:items-center">
                  {/* Player */}
                  <div className="min-w-0 flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p?.image_url || FALLBACK_SVG}
                      alt={p?.full_name || "Player"}
                      className="h-10 w-10 rounded object-cover"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-medium">{p?.full_name ?? "(unknown)"}</div>
                        {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Unsaved changes" />}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {row.player_id && <span className="rounded bg-muted/60 px-1.5 py-0.5">Players</span>}
                        {row.player_entry_id && <span className="rounded bg-muted/60 px-1.5 py-0.5">Entry</span>}
                        {p?.transfermarkt_url && (
                          <a
                            href={p.transfermarkt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 underline hover:text-foreground"
                          >
                            TM <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <span className="inline-flex items-center gap-2 md:hidden">
                          <span className="inline-flex items-center gap-1" title="Tekst">
                            <FileText className="h-3.5 w-3.5" /> {textNoteForRow}
                          </span>
                          <span className="inline-flex items-center gap-1" title="Głos">
                            <Mic className="h-3.5 w-3.5" /> {voiceCountForRow}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Minutes */}
                  <div className="grid gap-1">
                    <label className="text-[11px] text-muted-foreground md:hidden">Minuty</label>
                    <Input
                      inputMode="numeric"
                      type="number"
                      min={0}
                      className="h-8 text-right"
                      defaultValue={row.minutes_watched ?? 0}
                      onChange={(e) => setRowDraft(row.id, { minutes_watched: Number(e.target.value || 0) })}
                      aria-label="Minutes watched"
                    />
                  </div>

                  {/* Overall 1–5 */}
                  <div className="grid gap-1">
                    <label className="text-[11px] text-muted-foreground md:hidden">Ocena ogólna (1–5)</label>
                    <Rate5
                      value={currentOverall || 0}
                      onChange={(n) => setRowDraft(row.id, { rating: n })}
                      ariaLabel="Overall rating"
                    />
                  </div>

                  {/* Sub-ratings */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div className="grid gap-0.5">
                      <span className="text-[11px] text-muted-foreground">Ofensywa</span>
                      <Rate5 value={curOff} onChange={(n) => setRowDraft(row.id, { offense_rating: n })} ariaLabel="Ofensywa" />
                    </div>
                    <div className="grid gap-0.5">
                      <span className="text-[11px] text-muted-foreground">Defensywa</span>
                      <Rate5 value={curDef} onChange={(n) => setRowDraft(row.id, { defense_rating: n })} ariaLabel="Defensywa" />
                    </div>
                    <div className="grid gap-0.5">
                      <span className="text-[11px] text-muted-foreground">Technika</span>
                      <Rate5 value={curTec} onChange={(n) => setRowDraft(row.id, { technique_rating: n })} ariaLabel="Technika" />
                    </div>
                    <div className="grid gap-0.5">
                      <span className="text-[11px] text-muted-foreground">Motoryka</span>
                      <Rate5 value={curMot} onChange={(n) => setRowDraft(row.id, { motor_rating: n })} ariaLabel="Motoryka" />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant={isNotesOpen ? "secondary" : "outline"}
                      className="gap-2"
                      onClick={() => toggleRowNotes(row.id)}
                      aria-expanded={isNotesOpen}
                      aria-controls={`notes-${row.id}`}
                    >
                      <FileText className="h-4 w-4" />
                      <span className="hidden md:inline">
                        {isNotesOpen ? `Ukryj notatki (${voiceCountForRow})` : `Notatki (${voiceCountForRow})`}
                      </span>
                      <span className="md:hidden tabular-nums">({voiceCountForRow})</span>
                    </Button>

                    {showRowSave(row.id) && (
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={() => saveRow(row.id)}
                        disabled={isSaving}
                        aria-label="Save row"
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        <span className="hidden md:inline">Zapisz</span>
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-2"
                      onClick={() => deleteRow(row.id)}
                      disabled={isSaving}
                      aria-label="Remove row"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden md:inline">Usuń</span>
                    </Button>
                  </div>
                </div>

                {/* Voice notes panel */}
                {isNotesOpen && (
                  <div id={`notes-${row.id}`} className="pt-2">
                    <VoiceNotesPanel
                      key={rowNotesKey[row.id] || 0}
                      observationId={session.id}
                      playerId={row.player_id ?? undefined}
                      observationPlayerId={row.id}
                      title="Notatki głosowe (zawodnik)"
                    />
                  </div>
                )}

                {/* Text notes (inline) */}
                <div className="pt-2">
                  <Textarea
                    rows={2}
                    className="w-full"
                    defaultValue={row.notes ?? ""}
                    onChange={(e) => setRowDraft(row.id, { notes: e.target.value })}
                    placeholder="Notatki do tego zawodnika…"
                    aria-label="Player notes"
                  />
                </div>
              </div>
            )
          })}

          {!rows.length && (
            <div className="rounded-md bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
              Brak zawodników. Użyj wyszukiwarki lub Quick add.
            </div>
          )}
        </div>
      </section>

      {/* ---------- Quick Add Player Dialog ---------- */}
      <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick add player</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">Full name *</label>
              <Input
                value={quickForm.full_name}
                onChange={(e) => setQuickForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">Date of birth *</label>
              <Input
                type="date"
                value={quickForm.date_of_birth}
                onChange={(e) => setQuickForm((f) => ({ ...f, date_of_birth: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">Position</label>
                <Input
                  value={quickForm.main_position}
                  onChange={(e) => setQuickForm((f) => ({ ...f, main_position: e.target.value }))}
                  placeholder="CM / ST"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">Foot</label>
                <Input
                  value={quickForm.dominant_foot}
                  onChange={(e) =>
                    setQuickForm((f) => ({ ...f, dominant_foot: e.target.value as any }))
                  }
                  placeholder="left / right / both"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">Country</label>
                <Input
                  value={quickForm.country_of_birth}
                  onChange={(e) => setQuickForm((f) => ({ ...f, country_of_birth: e.target.value }))}
                  placeholder="Country"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setQuickOpen(false)}>Cancel</Button>
            <Button onClick={createQuickPlayer} disabled={quickBusy}>
              {quickBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create & add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
