// src/app/scout/leads/new/page.tsx
"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/browser"
import { toast } from "sonner"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

import { Calendar, Clock, Users, Shirt, Upload, CheckCircle2 } from "lucide-react"

type SessionRow = {
  id: string
  title: string | null
  match_date: string // date
  created_at: string
}

function useCurrentUserId() {
  const supabase = createClient()
  const [uid, setUid] = useState<string | null>(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return uid
}

function luminanceHex(hex: string) {
  let c = hex.replace("#", "")
  if (c.length === 3) c = c.split("").map((ch) => ch + ch).join("")
  const r = parseInt(c.slice(0, 2), 16) / 255
  const g = parseInt(c.slice(2, 4), 16) / 255
  const b = parseInt(c.slice(4, 6), 16) / 255
  const lin = (x: number) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4))
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return L
}

function TShirtPreview({
  jerseyColor,
  number,
  teamName,
}: {
  jerseyColor: string
  number: string
  teamName: string
}) {
  const textColor = useMemo(() => (luminanceHex(jerseyColor) > 0.4 ? "#111827" : "#ffffff"), [jerseyColor])
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative rounded-2xl border shadow-sm overflow-hidden"
        style={{ width: 260, height: 300, background: "repeating-conic-gradient(from 45deg, transparent 0 10deg, #00000006 10deg 20deg)" }}
      >
        {/* Shirt SVG */}
        <svg viewBox="0 0 220 220" width="220" height="220" className="absolute left-1/2 -translate-x-1/2 top-3">
          <path
            d="M30 50 L70 30 L150 30 L190 50 L170 80 L170 180 L50 180 L50 80 Z"
            fill={jerseyColor}
            stroke="#00000022"
            strokeWidth="2"
          />
          <path d="M85 40 L135 40 L130 55 L90 55 Z" fill="#00000018" />
        </svg>

        {/* CENTERED number */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none"
          style={{
            fontSize: 96,
            fontWeight: 800,
            fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
            color: textColor,
            textShadow: "0 1px 0 rgba(0,0,0,.25)",
            letterSpacing: -2,
            lineHeight: 1,
          }}
          aria-label="Jersey number preview"
        >
          {number || "?"}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">{teamName || "Team name"}</div>
    </div>
  )
}

export default function NewLeadPage() {
  const supabase = createClient()
  const router = useRouter()
  const uid = useCurrentUserId()
  const [isPending, start] = useTransition()

  // --- form state (STACKED inputs — one under another) ---
  const [team, setTeam] = useState("")
  const [opp, setOpp] = useState("")
  const [dateStr, setDateStr] = useState("") // yyyy-mm-dd
  const [timeStr, setTimeStr] = useState("") // HH:mm
  const [jersey, setJersey] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [jerseyColor, setJerseyColor] = useState("#ef4444") // preview color

  // sessions
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)

  // load sessions for the user
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!uid) return
      setLoadingSessions(true)
      const { data, error } = await supabase
        .from("observation_sessions")
        .select("id,title,match_date,created_at")
        .eq("scout_id", uid)
        .order("created_at", { ascending: false })
        .limit(30)
      if (active) {
        if (!error) setSessions((data as SessionRow[]) ?? [])
        setLoadingSessions(false)
      }
    })()
    return () => {
      active = false
    }
  }, [uid, supabase])

  const matchDate = useMemo(() => {
    if (!dateStr || !timeStr) return null
    try {
      const dt = new Date(`${dateStr}T${timeStr}:00`)
      if (isNaN(dt.getTime())) return null
      return dt
    } catch {
      return null
    }
  }, [dateStr, timeStr])

  const dedupeSig = useMemo(() => {
    if (!team || !matchDate) return ""
    const epoch = Math.floor(matchDate.getTime() / 1000)
    const minuteBucket = Math.floor(epoch / 60)
    const jerseyPart = (jersey || "").trim()
    return `${team.toLowerCase()}|${minuteBucket}|${jerseyPart}`
  }, [team, matchDate, jersey])

  const canSave = useMemo(() => {
    return !!team.trim() && !!matchDate && !isPending
  }, [team, matchDate, isPending])

  const handleSave = useCallback(() => {
    start(async () => {
      if (!uid) {
        toast.error("You must be signed in.")
        router.push("/login?redirect_to=/scout/leads/new")
        return
      }
      if (!team.trim()) {
        toast.error("Team name is required.")
        return
      }
      if (!matchDate) {
        toast.error("Select date and time of the game.")
        return
      }

      // try RPC (if present)
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc("upsert_unknown_lead", {
          p_team_name: team.trim(),
          p_opponent_name: opp || null,
          p_match_datetime: matchDate.toISOString(),
          p_jersey_number: jersey ? Number(jersey) : null,
          p_notes: notes || null,
          p_observation_session_id: sessionId,
        })
        if (rpcErr) throw rpcErr
        const lead = Array.isArray(rpcData) ? rpcData[0] : rpcData
        if (lead?.id) {
          toast.success("Lead saved", {
            description: `${team} vs ${opp || "?"} • ${dateStr} ${timeStr}`,
            action: { label: "Open list", onClick: () => router.push("/scout/leads") },
          })
          router.push("/scout/leads")
          return
        }
      } catch {
        // fallback
      }

      const { error } = await supabase
        .from("player_leads")
        .insert({
          team_name: team.trim(),
          opponent_name: opp || null,
          match_datetime: matchDate.toISOString(),
          jersey_number: jersey ? Number(jersey) : null,
          notes: notes || null,
          observation_session_id: sessionId,
          dedupe_sig: dedupeSig || null,
        })
      if (error) {
        toast.error("Failed to save lead", { description: error.message })
        return
      }

      toast.success("Lead saved", {
        description: `${team} vs ${opp || "?"} • ${dateStr} ${timeStr}`,
        action: { label: "Open list", onClick: () => router.push("/scout/leads") },
      })
      router.push("/scout/leads")
    })
  }, [uid, team, opp, matchDate, jersey, notes, sessionId, dedupeSig, dateStr, timeStr, router, supabase])

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">New Lead (Unknown Player)</h1>
          <p className="text-sm text-muted-foreground">
            Track an unidentified player by jersey number and match details. We’ll merge identical reports from other scouts.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4" />
          Required: Team, Date &amp; Time
        </div>
      </div>

      {/* One-row layout: 75% form (left) / 25% live preview (right). Stacks on small screens */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:gap-6">
        {/* LEFT 75% — STACKED inputs */}
        <div className="w-full lg:w-3/4">
          <Card className="p-4 lg:p-6 rounded-2xl space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div className="grid gap-1.5">
                <Label className="flex items-center gap-2"><Users className="h-4 w-4" /> Team *</Label>
                <Input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Observed team" />
              </div>

              <div className="grid gap-1.5">
                <Label>Opponent</Label>
                <Input value={opp} onChange={(e) => setOpp(e.target.value)} placeholder="Opponent team" />
              </div>

              <div className="grid gap-1.5">
                <Label className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Match date *</Label>
                <Input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
              </div>

              <div className="grid gap-1.5">
                <Label className="flex items-center gap-2"><Clock className="h-4 w-4" /> Kick-off *</Label>
                <Input type="time" value={timeStr} onChange={(e) => setTimeStr(e.target.value)} />
              </div>

              <div className="grid gap-1.5">
                <Label className="flex items-center gap-2"><Shirt className="h-4 w-4" /> Jersey #</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={jersey}
                  onChange={(e) => setJersey(e.target.value)}
                  placeholder="e.g. 10"
                />
              </div>

              <div className="grid gap-1.5">
                <Label>Observation session</Label>
                <Select
                  value={sessionId ?? "none"}
                  onValueChange={(v) => setSessionId(v === "none" ? null : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Link a session…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {loadingSessions ? (
                      <SelectItem value="_loading" disabled>Loading…</SelectItem>
                    ) : (
                      sessions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {(s.title || "Untitled") + " · " + s.match_date}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any quick context…"
                />
              </div>

              <div className="grid gap-1.5">
                <Label>Jersey color</Label>
                <div className="flex items-center gap-2">
                  <Input type="color" value={jerseyColor} onChange={(e) => setJerseyColor(e.target.value)} className="h-10 w-14 p-1" />
                  <Input value={jerseyColor} onChange={(e) => setJerseyColor(e.target.value)} className="font-mono" />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>Signature</Label>
                <Input value={dedupeSig} readOnly className="font-mono text-xs" />
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT 25% — Live preview */}
        <div className="w-full lg:w-1/4 mt-4 lg:mt-0">
          <Card className="p-4 rounded-2xl lg:sticky lg:top-6">
            <div className="text-sm font-medium mb-3">Live Preview</div>
            <div className="flex justify-center">
              <TShirtPreview jerseyColor={jerseyColor} number={jersey} teamName={team} />
            </div>
          </Card>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/scout/leads")}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <Upload className="h-4 w-4 animate-pulse" /> Saving…
              </span>
            ) : ("Save")}
          </Button>
        </div>
      </div>
    </div>
  )
}
