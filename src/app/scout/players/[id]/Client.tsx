"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/browser"
import { toast } from "sonner"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

import {
  Calendar,
  Footprints,
  Flag,
  Building2,
  Save,
  Loader2,
  Trash2,
  Sparkles,
  Star,
  FileText,
  ClipboardCopy,
  Check,
  Plus,
  User2,
  Phone,
  Mail,
  ShieldCheck,
  Trophy,
  BarChart3,
} from "lucide-react"

const CATEGORIES = [
  { key: "motor", label: "Motor skills – speed, stamina" },
  { key: "strength_agility", label: "Strength, duels, agility" },
  { key: "technique", label: "Technique" },
  { key: "with_ball", label: "Moves with a ball" },
  { key: "without_ball", label: "Moves without a ball" },
  { key: "set_pieces", label: "Set pieces" },
  { key: "defensive", label: "Defensive phase" },
  { key: "attacking", label: "Attacking phase" },
  { key: "transitions", label: "Transitional phases" },
  { key: "attitude", label: "Attitude (mentality)" },
  { key: "final_comment", label: "Final comment" },
] as const

const NOTE_SCALE = [1, 2, 3, 4, 5, 6] as const // <- 1–6 scale

type Observation = {
  id: string
  match_date: string
  competition: string | null
  opponent: string | null
  minutes_watched: number | null
  notes: string | null
  created_at: string
}
type Note = {
  id: string
  category: string
  rating: number | null
  comment: string | null
  created_at: string
  updated_at: string
}

export default function Client({
  userId,
  player,
  observations,
  notes,
}: {
  userId: string
  player: any
  observations: Observation[]
  notes: Note[]
}) {
  const supabase = createClient()
  const [isSaving, startSaving] = useTransition()

  /* ---------------- Editable player form ---------------- */
  const [form, setForm] = useState({
    first_name: player.first_name ?? "",
    last_name: player.last_name ?? "",
    date_of_birth: player.date_of_birth ?? "",
    height_cm: player.height_cm ?? "",
    weight_kg: player.weight_kg ?? "",
    country_of_birth: player.country_of_birth ?? "",
    has_eu_passport: !!player.has_eu_passport,
    current_club_name: player.current_club_name ?? "",
    current_club_country: player.current_club_country ?? "",
    current_club_tier: player.current_club_tier ?? "",
    main_position: player.main_position ?? "",
    dominant_foot: player.dominant_foot ?? "",
    english_speaks: !!player.english_speaks,
    english_level: player.english_level ?? "",
    contact_phone: player.contact_phone ?? "",
    contact_email: player.contact_email ?? "",
    coach_contact: player.coach_contact ?? "",
    contract_status: player.contract_status ?? "",
    contract_until: player.contract_until ?? "",
    agency: player.agency ?? "",
    appearances: player.appearances ?? "",
    minutes: player.minutes ?? "",
    goals_last_season: player.goals_last_season ?? "",
    assists_last_season: player.assists_last_season ?? "",
    dribbles_last_season: player.dribbles_last_season ?? "",
    injuries_last_3y: player.injuries_last_3y ?? "",
    transfermarkt_url: player.transfermarkt_url ?? "",
  })
  function set<K extends keyof typeof form>(k: K, v: any) {
    setForm(p => ({ ...p, [k]: v }))
  }

  const REQUIRED_KEYS: (keyof typeof form)[] = [
    "first_name","last_name","date_of_birth","main_position","dominant_foot",
    "current_club_name","current_club_country","current_club_tier",
    "height_cm","weight_kg","country_of_birth","english_level","contact_email",
  ]
  const completeness = useMemo(() => {
    const total = REQUIRED_KEYS.length
    const filled = REQUIRED_KEYS.reduce((acc, k) => acc + (String(form[k] ?? "").toString().trim() ? 1 : 0), 0)
    return Math.round((filled / total) * 100)
  }, [form])

  const save = () => {
    startSaving(async () => {
      const payload: any = {
        ...form,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        current_club_tier: form.current_club_tier ? Number(form.current_club_tier) : null,
        appearances: form.appearances ? Number(form.appearances) : null,
        minutes: form.minutes ? Number(form.minutes) : null,
        goals_last_season: form.goals_last_season ? Number(form.goals_last_season) : null,
        assists_last_season: form.assists_last_season ? Number(form.assists_last_season) : null,
        dribbles_last_season: form.dribbles_last_season ? Number(form.dribbles_last_season) : null,
        injuries_last_3y: form.injuries_last_3y ? Number(form.injuries_last_3y) : null,
        full_name: `${(form.first_name||"").trim()} ${(form.last_name||"").trim()}`.trim(),
      }
      const { error } = await supabase.from("players").update(payload).eq("id", player.id)
      if (error) toast.error(error.message)
      else toast.success("Player updated", { description: payload.full_name })
    })
  }

  /* ---------------- Notes (horizontal, 1–6) ---------------- */
  type CatState = { id?: string; rating: number; comment: string; saving?: boolean; savedAt?: number }
  const initialNotesState: Record<string, CatState> = useMemo(() => {
    const state: Record<string, CatState> = {}
    CATEGORIES.forEach(c => {
      const n = notes.find(nn => nn.category === c.key)
      state[c.key] = {
        id: n?.id,
        rating: (n?.rating && NOTE_SCALE.includes(Math.max(1, Math.min(6, n.rating)) as any)) ? (n?.rating as number) : 0,
        comment: n?.comment ?? "",
      }
    })
    return state
  }, [notes])

  const [catNotes, setCatNotes] = useState<Record<string, CatState>>(initialNotesState)
  const [activeCat, setActiveCat] = useState<string>(CATEGORIES[0].key)
  const saveTimers = useRef<Record<string, any>>({})

  function setCat(cat: string, patch: Partial<CatState>, autosave = true) {
    setCatNotes(prev => {
      const next = { ...prev, [cat]: { ...prev[cat], ...patch } }
      return next
    })
    if (!autosave) return
    if (saveTimers.current[cat]) clearTimeout(saveTimers.current[cat])
    saveTimers.current[cat] = setTimeout(() => persistNote(cat), 500)
  }

  async function persistNote(cat: string) {
    const s = catNotes[cat]
    if (!s) return
    const payload = {
      scout_id: userId,
      player_id: player.id,
      category: cat,
      rating: s.rating > 0 ? s.rating : null, // 1–6, null if 0/unset
      comment: s.comment?.trim() ? s.comment : null,
    }
    setCat(cat, { saving: true }, false)
    try {
      if (s.id) {
        const { error } = await supabase.from("scout_notes").update(payload).eq("id", s.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from("scout_notes").insert(payload).select("id").single()
        if (error) throw error
        setCat(cat, { id: data?.id }, false)
      }
      setCat(cat, { saving: false, savedAt: Date.now() }, false)
    } catch (e: any) {
      setCat(cat, { saving: false }, false)
      toast.error(e?.message || "Failed to save note")
    }
  }

  async function deleteNote(cat: string) {
    const s = catNotes[cat]
    if (s?.id) {
      const { error } = await supabase.from("scout_notes").delete().eq("id", s.id)
      if (error) return toast.error(error.message)
    }
    setCat(cat, { id: undefined, rating: 0, comment: "" }, false)
    toast.success("Note removed")
  }

  /* ---------------- Derived: notes coverage & average ---------------- */
  const notesCoverage = useMemo(() => {
    let filled = 0
    for (const k of Object.keys(catNotes)) {
      const s = catNotes[k]
      if (!s) continue
      if ((s.rating ?? 0) > 0 || (s.comment ?? "").trim()) filled += 1
    }
    return { filled, total: CATEGORIES.length }
  }, [catNotes])

  const notesAverage = useMemo(() => {
    const ratings: number[] = []
    for (const k of Object.keys(catNotes)) {
      const r = catNotes[k]?.rating ?? 0
      if (r && r > 0) ratings.push(r)
    }
    if (!ratings.length) return null
    return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
  }, [catNotes])

  /* ---------------- Assistant (local) suggestions tuned for 1–6 ---------------- */
  const [aiBusy, setAiBusy] = useState(false)
  const [aiText, setAiText] = useState("")
  const [copied, setCopied] = useState(false)

  function generateLocalInsights() {
    const ratings = Object.entries(catNotes)
      .filter(([k]) => k !== "final_comment")
      .map(([key, s]) => ({ key, rating: s.rating ?? 0, comment: (s.comment ?? "").trim() }))

    // Scale: 1–2 weak, 3–4 solid, 5–6 strong
    const strong = ratings.filter(r => r.rating >= 5).map(r => r.key)
    const solid = ratings.filter(r => r.rating >= 3 && r.rating <= 4).map(r => r.key)
    const weak  = ratings.filter(r => r.rating > 0 && r.rating <= 2).map(r => r.key)
    const missing = ratings.filter(r => r.rating === 0 && !r.comment).map(r => r.key)

    const label = (k: string) => CATEGORIES.find(c => c.key === k)?.label ?? k

    const strengths = strong.length
      ? `• **Strengths:** ${strong.map(label).join(", ")}.`
      : `• **Strengths:** still forming — collect more clips to confirm standout areas.`

    const improvements = weak.length
      ? `• **Areas to improve:** ${weak.map(label).join(", ")}.`
      : `• **Areas to improve:** none flagged ≤2/6 yet; keep monitoring under pressure.`

    const consistency = solid.length
      ? `• **Solid (3–4/6):** ${solid.map(label).join(", ")}.`
      : `• **Solid aspects:** not enough categories at 3–4 to judge consistency.`

    const nextFocus = missing.length
      ? `• **Next focus:** add ratings for ${missing.map(label).join(", ")} to complete the profile.`
      : `• **Next focus:** revisit borderline categories and capture more sequences.`

    const comms =
      form.english_speaks === false || String(form.english_level || "").toUpperCase() === "A2"
        ? `• **Off-field:** consider English or comms drills to improve integration.`
        : ""

    const physical =
      (Number(form.height_cm) || 0) < 172
        ? `• **Physical:** below-average height — emphasize agility and timing in duels.`
        : (Number(form.height_cm) || 0) > 188
        ? `• **Physical:** leverage aerial ability and set-pieces given the frame.`
        : ""

    const minutes = Number(form.minutes) || 0
    const exposure =
      minutes < 900
        ? `• **Exposure:** limited minutes this season; validate in 2–3 additional full matches.`
        : ""

    const avgText = notesAverage == null ? "n/a" : `${notesAverage}/6 across ${notesCoverage.filled} cat.`

    return `**Scout summary (draft)**
Avg: ${avgText}

${strengths}
${improvements}
${consistency}
${nextFocus}
${[comms, physical, exposure].filter(Boolean).join("\n")}`.trim()
  }

  async function runAI() {
    setAiBusy(true)
    try {
      const text = generateLocalInsights()
      setAiText(text)
    } finally {
      setAiBusy(false)
    }
  }

  const insertIntoFinalComment = () => {
    setCat("final_comment", { comment: aiText || generateLocalInsights() })
    toast.success("Inserted into Final comment")
  }

  const copyAi = async () => {
    try {
      await navigator.clipboard.writeText(aiText || generateLocalInsights())
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      toast.error("Could not copy")
    }
  }

  /* ---------------- Observations (right column) ---------------- */
  const [obs, setObs] = useState<Observation[]>(observations)

  /* ---------------- Render ---------------- */
  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 md:px-0">
        {player.image_url
          ? <img src={player.image_url} alt={player.full_name} className="h-20 w-20 rounded-xl object-cover border" />
          : <div className="grid h-20 w-20 place-items-center rounded-xl bg-muted text-xs text-muted-foreground">No photo</div>
        }
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{player.full_name}</h1>
          <div className="text-sm text-muted-foreground">
            {player.main_position ? `Pos: ${player.main_position}` : "—"}
            {player.current_club_name ? ` · ${player.current_club_name}` : "" }
            {player.current_club_country ? ` (${player.current_club_country})` : "" }
          </div>

          {/* notes summary chips */}
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1" title="How many categories have a rating or comment">
              <FileText className="h-3.5 w-3.5" />
              Notes {notesCoverage.filled}/{notesCoverage.total}
            </Badge>
            <Badge variant="outline" className="gap-1" title="Average of non-zero category ratings (1–6)">
              <Star className="h-3.5 w-3.5" />
              Avg {notesAverage ?? "—"}/6
            </Badge>
          </div>
        </div>
      </div>

      {/* Progress */}
      <Card className="mx-0 rounded-2xl p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Profile completion</div>
          <div className="text-sm text-muted-foreground">{completeness}%</div>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-3 bg-primary transition-all" style={{ width: `${completeness}%` }} />
        </div>
      </Card>

      {/* Player information — improved tabs */}
      <Card className="mx-0 rounded-2xl p-0">
        <div className="flex items-center justify-between px-4 pt-4 md:px-6">
          <h2 className="text-lg font-semibold">Player information</h2>
          <Button onClick={save} disabled={isSaving} aria-label="Save player information">
            {isSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving</>) : (<><Save className="mr-2 h-4 w-4" />Save</>)}
          </Button>
        </div>

        <Tabs defaultValue="identity" className="mt-3">
          <div className="px-4 md:px-6">
            <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabsList className="min-w-max gap-1 whitespace-nowrap">
                <TabsTrigger value="identity" className="gap-2"><User2 className="h-4 w-4" /> Basic</TabsTrigger>
                <TabsTrigger value="club" className="gap-2"><Building2 className="h-4 w-4" /> Club</TabsTrigger>
                <TabsTrigger value="physical" className="gap-2"><Footprints className="h-4 w-4" /> Physical</TabsTrigger>
                <TabsTrigger value="contact" className="gap-2"><Phone className="h-4 w-4" /> Contact</TabsTrigger>
                <TabsTrigger value="contract" className="gap-2"><ShieldCheck className="h-4 w-4" /> Contract</TabsTrigger>
                <TabsTrigger value="stats" className="gap-2"><BarChart3 className="h-4 w-4" /> Stats</TabsTrigger>
                <TabsTrigger value="links" className="gap-2"><Trophy className="h-4 w-4" /> Links</TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* IDENTITY */}
          <TabsContent value="identity" className="px-4 pb-4 pt-2 md:px-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="First name"><Input value={form.first_name} onChange={e=>set("first_name", e.target.value)} /></Field>
              <Field label="Last name"><Input value={form.last_name} onChange={e=>set("last_name", e.target.value)} /></Field>
              <Field label="Date of birth" icon={<Calendar className="h-4 w-4" />}>
                <Input type="date" value={form.date_of_birth} onChange={e=>set("date_of_birth", e.target.value)} />
              </Field>
              <Field label="Main position"><Input value={form.main_position} onChange={e=>set("main_position", e.target.value)} placeholder="e.g. CM, ST" /></Field>
              <Field label="Dominant foot" icon={<Footprints className="h-4 w-4" />}>
                <Input value={form.dominant_foot} onChange={e=>set("dominant_foot", e.target.value)} placeholder="left / right / both" />
              </Field>
              <Field label="Country of birth" icon={<Flag className="h-4 w-4" />}>
                <Input value={form.country_of_birth} onChange={e=>set("country_of_birth", e.target.value)} />
              </Field>
              <ToggleField label="EU passport" checked={form.has_eu_passport} onChange={(v)=>set("has_eu_passport", v)} />
              <ToggleField label="Speaks English" checked={form.english_speaks} onChange={(v)=>set("english_speaks", v)} />
              <Field label="English level"><Input value={form.english_level} onChange={e=>set("english_level", e.target.value)} placeholder="A2/B1/B2/C1" /></Field>
            </div>
          </TabsContent>

          {/* CLUB */}
          <TabsContent value="club" className="px-4 pb-4 pt-2 md:px-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Current club" icon={<Building2 className="h-4 w-4" />}>
                <Input value={form.current_club_name} onChange={e=>set("current_club_name", e.target.value)} />
              </Field>
              <Field label="Club country"><Input value={form.current_club_country} onChange={e=>set("current_club_country", e.target.value)} /></Field>
              <Field label="League level"><Input type="number" value={form.current_club_tier} onChange={e=>set("current_club_tier", e.target.value)} /></Field>
              <Field label="Coach/Club contact"><Input value={form.coach_contact} onChange={e=>set("coach_contact", e.target.value)} /></Field>
              <Field label="Agency"><Input value={form.agency} onChange={e=>set("agency", e.target.value)} /></Field>
            </div>
          </TabsContent>

          {/* PHYSICAL */}
          <TabsContent value="physical" className="px-4 pb-4 pt-2 md:px-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Height (cm)"><Input type="number" value={form.height_cm} onChange={e=>set("height_cm", e.target.value)} /></Field>
              <Field label="Weight (kg)"><Input type="number" value={form.weight_kg} onChange={e=>set("weight_kg", e.target.value)} /></Field>
            </div>
          </TabsContent>

          {/* CONTACT */}
          <TabsContent value="contact" className="px-4 pb-4 pt-2 md:px-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Contact phone" icon={<Phone className="h-4 w-4" />}>
                <Input value={form.contact_phone} onChange={e=>set("contact_phone", e.target.value)} />
              </Field>
              <Field label="Contact email" icon={<Mail className="h-4 w-4" />}>
                <Input value={form.contact_email} onChange={e=>set("contact_email", e.target.value)} />
              </Field>
              <div />
            </div>
          </TabsContent>

          {/* CONTRACT */}
          <TabsContent value="contract" className="px-4 pb-4 pt-2 md:px-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Contract status"><Input value={form.contract_status} onChange={e=>set("contract_status", e.target.value)} /></Field>
              <Field label="Contract until"><Input type="date" value={form.contract_until || ""} onChange={e=>set("contract_until", e.target.value)} /></Field>
              <div />
            </div>
          </TabsContent>

          {/* STATS */}
          <TabsContent value="stats" className="px-4 pb-4 pt-2 md:px-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Appearances"><Input type="number" value={form.appearances} onChange={e=>set("appearances", e.target.value)} /></Field>
              <Field label="Minutes"><Input type="number" value={form.minutes} onChange={e=>set("minutes", e.target.value)} /></Field>
              <div />
              <Field label="Goals (last season)"><Input type="number" value={form.goals_last_season} onChange={e=>set("goals_last_season", e.target.value)} /></Field>
              <Field label="Assists (last season)"><Input type="number" value={form.assists_last_season} onChange={e=>set("assists_last_season", e.target.value)} /></Field>
              <Field label="Dribbles (last season)"><Input type="number" value={form.dribbles_last_season} onChange={e=>set("dribbles_last_season", e.target.value)} /></Field>
              <Field label="Injuries (last 3y)"><Input type="number" value={form.injuries_last_3y} onChange={e=>set("injuries_last_3y", e.target.value)} /></Field>
            </div>
          </TabsContent>

          {/* LINKS */}
          <TabsContent value="links" className="px-4 pb-4 pt-2 md:px-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Transfermarkt URL"><Input value={form.transfermarkt_url} onChange={e=>set("transfermarkt_url", e.target.value)} /></Field>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Notes + Observations */}
      <div className="grid gap-6 px-4 md:grid-cols-2 md:px-0">
        {/* LEFT: Notes + Assistant */}
        <Card className="space-y-4 rounded-2xl p-4 md:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Scout notes</h2>
            <span className="text-xs text-muted-foreground">Only visible to you</span>
          </div>

          {/* Assistant helper */}
          <Card className="rounded-xl border bg-gradient-to-br from-amber-50 to-white p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4" />
                Assistant suggestions
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={copyAi} disabled={aiBusy}>
                  {copied ? <><Check className="mr-1 h-4 w-4" />Copied</> : <><ClipboardCopy className="mr-1 h-4 w-4" />Copy</>}
                </Button>
                <Button size="sm" onClick={runAI} disabled={aiBusy}>
                  {aiBusy ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Generating…</> : <>Generate</>}
                </Button>
                <Button size="sm" variant="secondary" onClick={insertIntoFinalComment} disabled={aiBusy}>
                  Insert into “Final comment”
                </Button>
              </div>
            </div>
            <Textarea
              className="mt-2 h-36"
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Click Generate to draft strengths, improvements and next focus…"
              aria-live="polite"
            />
          </Card>

          {/* Horizontal categories + per-category panel */}
          <Tabs value={activeCat} onValueChange={setActiveCat} className="space-y-3">
            {/* Scrollable category bar */}
            <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabsList className="min-w-max gap-1 whitespace-nowrap rounded-xl">
                {CATEGORIES.map((c) => (
                  <TabsTrigger
                    key={c.key}
                    value={c.key}
                    className="rounded-lg px-3 py-2 text-xs"
                  >
                    {c.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {CATEGORIES.map((cat) => {
              const s = catNotes[cat.key]
              const isFinal = cat.key === "final_comment"
              return (
                <TabsContent key={cat.key} value={cat.key}>
                  <div className="rounded-xl border bg-card/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium">{cat.label}</div>
                      <div className="flex items-center gap-2">
                        {!isFinal && (
                          <div className="inline-flex items-center gap-1 rounded-md border bg-background p-1">
                            {NOTE_SCALE.map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setCat(cat.key, { rating: n })}
                                className={
                                  `h-8 min-w-[36px] rounded-md px-2 text-xs
                                   ${s?.rating === n
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-white hover:bg-muted border"}`
                                }
                                aria-label={`${n} out of 6`}
                                aria-pressed={s?.rating === n}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Delete note"
                          onClick={() => deleteNote(cat.key)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {!isFinal && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        1 = poor · 3–4 = solid · 6 = elite
                      </p>
                    )}

                    <Textarea
                      className="mt-3 h-28 resize-none"
                      placeholder={isFinal ? "Final comment, summary, projection…" : "Short comment…"}
                      value={s?.comment ?? ""}
                      onChange={(e) => setCat(cat.key, { comment: e.target.value })}
                    />

                    <div className="mt-2 text-[11px] text-muted-foreground">
                      {s?.saving
                        ? (<span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> saving…</span>)
                        : s?.savedAt ? "saved" : "—"}
                    </div>
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>
        </Card>

        {/* RIGHT: Observations */}
        <ObservationsPanel
          supabase={supabase}
          userId={userId}
          playerId={player.id}
          observations={obs}
          onObservationsChange={setObs}
        />
      </div>
    </div>
  )
}

/* ---------- Observations panel (right column) ---------- */
function ObservationsPanel({
  supabase,
  userId,
  playerId,
  observations,
  onObservationsChange,
}: {
  supabase: ReturnType<typeof createClient>
  userId: string
  playerId: string
  observations: Observation[]
  onObservationsChange: (o: Observation[]) => void
}) {
  type SessionLite = { id: string; title: string | null; match_date: string }

  const [sessions, setSessions] = useState<SessionLite[]>([])
  const [chosenSession, setChosenSession] = useState<string>("")

  const [memberSessions, setMemberSessions] = useState<SessionLite[]>([])
  const [loadingMembers, setLoadingMembers] = useState<boolean>(true)
  const [adding, setAdding] = useState<boolean>(false)

  // create session dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newSession, setNewSession] = useState({
    match_date: "",
    title: "",
    competition: "",
    opponent: "",
    location: "",
  })

  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase
        .from("observation_sessions")
        .select("id, title, match_date")
        .eq("scout_id", userId)
        .order("match_date", { ascending: false })
      if (error) {
        console.error("Load sessions error:", error)
        toast.error(error.message || "Failed to load observation sessions")
        return
      }
      setSessions(data || [])
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (!sessions.length) {
      setMemberSessions([])
      setLoadingMembers(false)
      return
    }
    loadMemberSessions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, playerId])

  async function loadMemberSessions() {
    setLoadingMembers(true)
    try {
      const sessionIds = sessions.map(s => s.id)
      if (!sessionIds.length) {
        setMemberSessions([])
        return
      }
      const { data, error } = await supabase
        .from("observation_players")
        .select("observation_id, player_id")
        .eq("player_id", playerId)
        .in("observation_id", sessionIds)

      if (error) {
        console.error("Load member sessions error:", error)
        toast.error(error.message || "Failed to load player memberships")
        return
      }

      const memberIds = new Set((data || []).map(r => r.observation_id as string))
      const rows: SessionLite[] = sessions.filter(s => memberIds.has(s.id))
      rows.sort((a, b) => (a.match_date < b.match_date ? 1 : -1))
      setMemberSessions(rows)
    } catch (e: any) {
      console.error("Load member sessions error:", e)
      toast.error(e?.message || "Failed to load player memberships")
    } finally {
      setLoadingMembers(false)
    }
  }

  async function addToObservation() {
    if (!chosenSession) {
      toast.info("Choose an observation session first")
      return
    }
    if (memberSessions.some(ms => ms.id === chosenSession)) {
      toast.info("Player is already in this observation")
      return
    }

    setAdding(true)
    try {
      const { error } = await supabase.from("observation_players").insert({
        observation_id: chosenSession,
        player_id: playerId,
        minutes_watched: null,
        rating: null,
        notes: null,
      })
      if (error) throw error

      toast.success("Player added to observation")

      await loadMemberSessions()

      const sess = sessions.find(s => s.id === chosenSession)
      if (sess?.match_date) {
        const { error: obsErr } = await supabase
          .from("observations")
          .insert({
            scout_id: userId,
            player_id: playerId,
            match_date: sess.match_date,
            competition: null,
            opponent: null,
            minutes_watched: null,
            notes: null,
          })
        if (obsErr) console.warn("Insert observations failed:", obsErr.message)

        const { data } = await supabase
          .from("observations")
          .select("id, match_date, competition, opponent, minutes_watched, notes, created_at")
          .eq("player_id", playerId).eq("scout_id", userId)
          .order("match_date", { ascending: false })
        onObservationsChange(data || [])
      }
    } catch (e: any) {
      console.error("Add to observation error:", e)
      toast.error(e?.message || "Could not add player to observation")
    } finally {
      setAdding(false)
    }
  }

  async function createSession() {
    if (!newSession.match_date) {
      toast.error("Match date is required")
      return
    }
    setCreating(true)
    try {
      const payload = {
        scout_id: userId,
        match_date: newSession.match_date,
        title: newSession.title?.trim() || null,
        competition: newSession.competition?.trim() || null,
        opponent: newSession.opponent?.trim() || null,
        location: newSession.location?.trim() || null,
        notes: null as string | null,
      }
      const { data, error } = await supabase
        .from("observation_sessions")
        .insert(payload)
        .select("id, title, match_date")
        .single()
      if (error) throw error

      setSessions(prev => {
        const next = [data!, ...prev]
        next.sort((a, b) => (a.match_date < b.match_date ? 1 : -1))
        return next
      })
      setChosenSession(data!.id)
      setCreateOpen(false)
      setNewSession({ match_date: "", title: "", competition: "", opponent: "", location: "" })
      toast.success("Observation session created")
    } catch (e: any) {
      console.error("Create session error:", e)
      toast.error(e?.message || "Could not create session")
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card className="space-y-4 rounded-2xl p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Your observations</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <Plus className="h-4 w-4" /> New session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create observation session</DialogTitle>
                <DialogDescription>Only match date is required. You can fill the rest later.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="new-date">Match date *</Label>
                  <Input
                    id="new-date"
                    type="date"
                    value={newSession.match_date}
                    onChange={(e)=>setNewSession(s=>({ ...s, match_date: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-title">Title</Label>
                  <Input
                    id="new-title"
                    value={newSession.title}
                    onChange={(e)=>setNewSession(s=>({ ...s, title: e.target.value }))}
                    placeholder="e.g. Observation 1"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-competition">Competition</Label>
                  <Input
                    id="new-competition"
                    value={newSession.competition}
                    onChange={(e)=>setNewSession(s=>({ ...s, competition: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-opponent">Opponent</Label>
                  <Input
                    id="new-opponent"
                    value={newSession.opponent}
                    onChange={(e)=>setNewSession(s=>({ ...s, opponent: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-location">Location</Label>
                  <Input
                    id="new-location"
                    value={newSession.location}
                    onChange={(e)=>setNewSession(s=>({ ...s, location: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={()=>setCreateOpen(false)}>Cancel</Button>
                <Button onClick={createSession} disabled={creating}>
                  {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>


          <Select value={chosenSession} onValueChange={setChosenSession} disabled={adding}>
            <SelectTrigger className="h-9 w-[260px]">
              <SelectValue placeholder="Choose observation session…" />
            </SelectTrigger>
            <SelectContent>
              {sessions.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">No sessions found</div>
              ) : (
                sessions.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.match_date} {s.title ? `· ${s.title}` : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={addToObservation} disabled={!chosenSession || adding}>
            {adding ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding…</> : "Add player"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">This player is in:</div>
        {loadingMembers ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : memberSessions.length === 0 ? (
          <div className="text-sm text-muted-foreground">No observations yet.</div>
        ) : (
          <div className="grid gap-2">
            {memberSessions.map(ms => (
              <div key={ms.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                <div className="text-sm font-medium">
                  {ms.match_date}{ms.title ? ` · ${ms.title}` : ""}
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/scout/observations/${ms.id}`}>Open</Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {observations.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="text-sm font-medium">Observation records</div>
            <div className="grid gap-3">
              {observations.map(o => (
                <div key={o.id} className="rounded-xl border p-3">
                  <div className="text-sm font-medium">
                    {o.match_date}{o.opponent ? ` · vs ${o.opponent}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {o.competition || "—"} {o.minutes_watched ? `· ${o.minutes_watched}’` : ""}
                  </div>
                  {o.notes && <p className="mt-2 text-sm">{o.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  )
}

/* ---------- tiny UI helpers ---------- */
function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="flex items-center gap-2">{icon}{label}</Label>
      {children}
    </div>
  )
}
function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v:boolean)=>void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div><Label>{label}</Label></div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
