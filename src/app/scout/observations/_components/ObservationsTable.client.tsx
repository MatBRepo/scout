// src/app/scout/observations/_components/ObservationsTable.tsx
"use client"

import React, { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/browser"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

import {
  ChevronRight,
  CalendarDays,
  Users,
  Loader2,
  Plus,
  Filter,
  ArrowUpAZ,
  ArrowDownAZ,
  RefreshCw,
  Search,
  Tv,
  Binoculars,
} from "lucide-react"

// Sheets (offcanvas)
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet"

// Reuse your full editor (client) inside the offcanvas
import ObservationEditor from "../[id]/view.client"

type Row = {
  id: string
  title: string | null
  match_date: string | null // YYYY-MM-DD
  competition: string | null
  opponent: string | null
  players_count: number
  mode?: "live" | "video" | null // <— NEW (safe if missing)
}

type EditorPayload = {
  session: any
  rows: any[]
}

type Props = { initialRows: Row[] }

type StatusFilter = "all" | "upcoming" | "past"
type SortKey = "date_desc" | "date_asc" | "players_desc" | "players_asc"

export default function ObservationsTable({ initialRows }: Props) {
  const [rows, setRows] = useState<Row[]>(initialRows)

  // Offcanvas: full editor
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorId, setEditorId] = useState<string | null>(null)
  const [editorBusy, setEditorBusy] = useState(false)
  const [editorData, setEditorData] = useState<EditorPayload | null>(null)

  // Offcanvas: create new session
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const initialCreate = {
    match_date: today,
    title: "",
    competition: "",
    opponent: "",
    location: "",
    notes: "",
    isLive: true as boolean, // <— NEW: UI toggle (true = live, false = video)
  }
  const [createForm, setCreateForm] = useState(initialCreate)

  // Toolbar state
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [sort, setSort] = useState<SortKey>("date_desc")

  // “refresh” hint (client-side only)
  const [refreshing, setRefreshing] = useState(false)

  const supabase = createClient()

  const openEditor = async (id: string) => {
    setEditorId(id)
    setEditorOpen(true)
    setEditorBusy(true)
    setEditorData(null)
    try {
      const [obs, list] = await Promise.all([
        supabase
          .from("observation_sessions")
          .select("*") // includes `mode`
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("observation_players")
          .select(`
            id,
            observation_id,
            player_id,
            player_entry_id,
            minutes_watched,
            rating,
            notes,
            players ( id, full_name, image_url, transfermarkt_url ),
            scout_player_entries ( id, full_name, image_url, transfermarkt_url )
          `)
          .eq("observation_id", id)
          .order("created_at", { ascending: false }),
      ])

      setEditorData({
        session: obs.data,
        rows: list.data ?? [],
      })
    } finally {
      setEditorBusy(false)
    }
  }

  const handleOpenCreate = () => {
    setCreateForm(initialCreate)
    setCreateOpen(true)
  }

  const handleCreate = async () => {
    if (!createForm.match_date) {
      toast.error("Match date is required")
      return
    }
    setCreating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error("You must be signed in")
        return
      }
      const payload = {
        scout_id: user.id,
        match_date: createForm.match_date,
        title: createForm.title.trim() || null,
        competition: createForm.competition.trim() || null,
        opponent: createForm.opponent.trim() || null,
        location: createForm.location.trim() || null,
        notes: createForm.notes.trim() || null,
        mode: createForm.isLive ? "live" as const : "video" as const, // <— NEW
      }
      const { data, error } = await supabase
        .from("observation_sessions")
        .insert(payload)
        .select("id, title, match_date, competition, opponent, mode")
        .single()
      if (error) throw error

      // Optimistically add to list
      const newRow: Row = {
        id: data.id,
        title: data.title,
        match_date: data.match_date,
        competition: data.competition,
        opponent: data.opponent,
        players_count: 0,
        mode: data.mode ?? "live",
      }
      setRows(prev => [newRow, ...prev])
      toast.success("Observation created")

      // Close create sheet & open full editor for this new session
      setCreateOpen(false)
      await openEditor(data.id)
    } catch (e: any) {
      toast.error(e?.message || "Failed to create observation")
    } finally {
      setCreating(false)
    }
  }

  const formatDate = (d?: string | null) =>
    d ? <time dateTime={d}>{d}</time> : "—"

  const statusOf = (dateStr?: string | null): "upcoming" | "past" | "unknown" => {
    if (!dateStr) return "unknown"
    const todayStr = new Date().toISOString().slice(0, 10)
    return dateStr >= todayStr ? "upcoming" : "past"
  }

  // ---- filtering + sorting (client side on current state) ----
  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = rows.filter(r => {
      const matchesQ =
        !q ||
        [r.title, r.competition, r.opponent]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(q))

      const s = statusOf(r.match_date)
      const matchesStatus =
        status === "all" ||
        (status === "upcoming" && s === "upcoming") ||
        (status === "past" && s === "past")

      return matchesQ && matchesStatus
    })

    switch (sort) {
      case "date_asc":
        list = [...list].sort((a, b) => (a.match_date || "").localeCompare(b.match_date || ""))
        break
      case "players_desc":
        list = [...list].sort((a, b) => (b.players_count || 0) - (a.players_count || 0))
        break
      case "players_asc":
        list = [...list].sort((a, b) => (a.players_count || 0) - (b.players_count || 0))
        break
      case "date_desc":
      default:
        list = [...list].sort((a, b) => (b.match_date || "").localeCompare(a.match_date || ""))
    }
    return list
  }, [rows, query, status, sort])

  // optional refresh hint (client-only UX)
  const onRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 600)
  }

  return (
    <>
      {/* Toolbar */}
      <Card className="mb-3 p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {/* Search */}
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              className="pl-8"
              value={query}
              placeholder="Search title, competition, opponent…"
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search observations"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Filter className="h-4 w-4" aria-hidden="true" /> Status
            </span>
            <Button
              size="sm"
              variant={status === "all" ? "default" : "outline"}
              onClick={() => setStatus("all")}
              aria-pressed={status === "all"}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={status === "upcoming" ? "default" : "outline"}
              onClick={() => setStatus("upcoming")}
              aria-pressed={status === "upcoming"}
            >
              Upcoming
            </Button>
            <Button
              size="sm"
              variant={status === "past" ? "default" : "outline"}
              onClick={() => setStatus("past")}
              aria-pressed={status === "past"}
            >
              Past
            </Button>
          </div>

          {/* Sort + actions */}
          <div className="flex items-center gap-2 md:ml-auto">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {sort.startsWith("date_") ? <CalendarDays className="h-4 w-4" /> : (sort.endsWith("_desc") ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />)}
              Sort
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
              aria-label="Sort observations"
            >
              <option value="date_desc">Date: newest</option>
              <option value="date_asc">Date: oldest</option>
              <option value="players_desc">Players: most</option>
              <option value="players_asc">Players: fewest</option>
            </select>

            <Button onClick={onRefresh} variant="outline" size="sm" className="gap-1" aria-live="polite">
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>

            <Button size="sm" className="gap-1.5" onClick={handleOpenCreate} aria-label="Create new observation">
              <Plus className="h-4 w-4" />
              New
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {/* -------- Mobile: stacked cards -------- */}
        <div className="space-y-3 p-3 md:hidden" role="list" aria-label="Observations (mobile)">
          {filteredSorted.map((r) => {
            const s = statusOf(r.match_date)
            return (
              <Card key={r.id} className="p-3" role="listitem">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate font-medium">
                        {r.title || r.competition || "Observation"}
                      </div>
                      {r.competition && (
                        <Badge variant="secondary" className="text-[11px]">
                          {r.competition}
                        </Badge>
                      )}
                      <StatusBadge status={s} />
                      <ModeBadge mode={(r.mode ?? "live") as "live" | "video"} /> {/* NEW */}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatDate(r.match_date)}
                      </span>
                      <span className="max-w-[60vw] truncate">
                        {r.opponent ? `vs ${r.opponent}` : "—"}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        {r.players_count}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => openEditor(r.id)}
                    aria-label="Open full editor"
                  >
                    Open <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </Card>
            )
          })}

          {filteredSorted.length === 0 && <EmptyState onCreate={handleOpenCreate} />}
        </div>

        {/* -------- Desktop: table -------- */}
        <div className="hidden max-w-full overflow-x-auto md:block">
          <table className="w-full min-w-[880px] text-sm" aria-label="Observations table">
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
              <tr className="text-xs text-muted-foreground [&>th]:px-3 [&>th]:py-2">
                <th className="text-left" scope="col">Date</th>
                <th className="min-w-[260px] text-left" scope="col">Title / Competition</th>
                <th className="text-left" scope="col">Opponent</th>
                <th className="text-left" scope="col">Players</th>
                <th className="text-left" scope="col">Mode</th> {/* NEW col */}
                <th className="text-right" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {/* quick-create row */}
              <tr className="border-t bg-muted/20">
                <td className="px-3 py-2" colSpan={6}>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Create a session for a match you want to observe.
                    </div>
                    <Button size="sm" className="gap-1.5" onClick={handleOpenCreate} aria-label="Create new observation">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      New
                    </Button>
                  </div>
                </td>
              </tr>

              {filteredSorted.map((r) => {
                const s = statusOf(r.match_date)
                return (
                  <tr key={r.id} className="border-t hover:bg-accent/30 focus-within:bg-accent/30 [&>td]:px-3 [&>td]:py-2">
                    <td className="whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        {formatDate(r.match_date)}
                      </div>
                    </td>
                    <td className="min-w-[240px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="max-w-[360px] truncate font-medium">
                          {r.title || r.competition || "Observation"}
                        </span>
                        {r.competition && (
                          <Badge variant="secondary" className="text-[11px]">
                            {r.competition}
                          </Badge>
                        )}
                        <StatusBadge status={s} />
                      </div>
                    </td>
                    <td className="max-w-[260px] truncate whitespace-nowrap">{r.opponent || "—"}</td>
                    <td className="whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        {r.players_count}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      <ModeBadge mode={(r.mode ?? "live") as "live" | "video"} />
                    </td>
                    <td className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => openEditor(r.id)}
                        aria-label="Open full editor"
                      >
                        Open <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                )
              })}

              {filteredSorted.length === 0 && (
                <tr className="border-t">
                  <td colSpan={6} className="px-3 py-10">
                    <EmptyState onCreate={handleOpenCreate} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ---------- Offcanvas: CREATE NEW (with Live/Video switch) ---------- */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-full md:max-w-xl"
        >
          <SheetHeader className="border-b bg-background/80 p-4 backdrop-blur">
            <SheetTitle className="text-base">New observation</SheetTitle>
            <SheetDescription className="text-xs">
              Choose if this session is live (in person) or via TV/video.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid gap-3">
              {/* Mode Switch */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="pr-3">
                  <div className="text-sm font-medium">Observation mode</div>
                  <div className="text-xs text-muted-foreground">
                    Live (in person) or Video (TV/stream/highlights)
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={createForm.isLive ? "secondary" : "outline"} className="gap-1">
                    {createForm.isLive ? <Binoculars className="h-3.5 w-3.5" /> : <Tv className="h-3.5 w-3.5" />}
                    {createForm.isLive ? "Live" : "Video"}
                  </Badge>
                  <Switch
                    checked={createForm.isLive}
                    onCheckedChange={(checked) => setCreateForm(f => ({ ...f, isLive: checked }))}
                    aria-label="Toggle observation mode (on = live, off = video)"
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Match date *</label>
                <Input
                  type="date"
                  value={createForm.match_date}
                  onChange={(e) => setCreateForm(f => ({ ...f, match_date: e.target.value }))}
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="e.g. Observation #12"
                  value={createForm.title}
                  onChange={(e) => setCreateForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Competition</label>
                <Input
                  placeholder="e.g. Premier League"
                  value={createForm.competition}
                  onChange={(e) => setCreateForm(f => ({ ...f, competition: e.target.value }))}
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Opponent</label>
                <Input
                  placeholder="e.g. vs Arsenal"
                  value={createForm.opponent}
                  onChange={(e) => setCreateForm(f => ({ ...f, opponent: e.target.value }))}
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Location</label>
                <Input
                  placeholder="e.g. Anfield"
                  value={createForm.location}
                  onChange={(e) => setCreateForm(f => ({ ...f, location: e.target.value }))}
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  placeholder="Any quick context for this session…"
                  value={createForm.notes}
                  onChange={(e) => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                  className="min-h-[100px]"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t p-3">
            <SheetClose asChild>
              <Button variant="outline">Cancel</Button>
            </SheetClose>
            <Button onClick={handleCreate} disabled={creating} aria-live="polite">
              {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : "Create"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ---------- Offcanvas: FULL EDITOR ---------- */}
      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-full md:max-w-3xl lg:max-w-5xl"
        >
          <SheetHeader className="border-b bg-background/80 p-4 backdrop-blur">
            <SheetTitle className="text-base">
              {editorData?.session?.title ||
                editorData?.session?.competition ||
                "Observation"}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {editorId ? `#${editorId}` : ""}
              {editorData?.session?.mode ? ` • ${editorData.session.mode === "live" ? "Live" : "Video"}` : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            {editorBusy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading editor…
              </div>
            )}

            {!editorBusy && editorData && editorData.session && (
              <ObservationEditor session={editorData.session} rows={editorData.rows} />
            )}

            {!editorBusy && (!editorData || !editorData.session) && (
              <div className="text-sm text-muted-foreground">Could not load this observation.</div>
            )}
          </div>

          <div className="border-t p-3 text-right">
            <SheetClose asChild>
              <Button variant="outline">Close</Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

/* ---------- Small helpers ---------- */
function StatusBadge({ status }: { status: "upcoming" | "past" | "unknown" }) {
  if (status === "upcoming") {
    return (
      <Badge variant="secondary" className="gap-1 text-[11px]">
        <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2">
          <path d="M12 6v6l4 2" />
          <circle cx="12" cy="12" r="10" />
        </svg>
        Upcoming
      </Badge>
    )
  }
  if (status === "past") return <Badge variant="outline">Past</Badge>
  return <Badge variant="outline">Scheduled</Badge>
}

function ModeBadge({ mode }: { mode: "live" | "video" }) {
  if (mode === "video") {
    return (
      <Badge variant="outline" className="gap-1 text-[11px]">
        <Tv className="h-3.5 w-3.5" />
        Video
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-1 text-[11px]">
      <Binoculars className="h-3.5 w-3.5" />
      Live
    </Badge>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="p-6 text-center">
      <div className="text-sm font-medium">No observations match your filters</div>
      <div className="mt-1 text-xs text-muted-foreground">
        Try clearing filters or create a new observation session.
      </div>
      <div className="mt-3">
        <Button onClick={onCreate} aria-label="Create new observation">
          <Plus className="mr-1 h-4 w-4" />
          New observation
        </Button>
      </div>
    </Card>
  )
}
