"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/browser"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

import { toast } from "sonner"
import { Search, Shield, Plus, Loader2, ExternalLink } from "lucide-react"

type Role = "scout" | "scout_agent" | "admin"

type Scout = {
  id: string
  full_name: string | null
  avatar_url: string | null
  country: string | null
  agency: string | null
  role: Role
  is_active: boolean
  created_at: string
  myPlayersCount: number
  entriesCount: number
}

type PlayerLite = {
  id: string
  full_name: string
  image_url: string | null
  main_position?: string | null
  current_club_name?: string | null
}

type NoteRow = {
  category: string
  rating: number | null
  comment: string | null
  created_at: string
  players?: { id: string; full_name: string; image_url: string | null } | null
}

const CATEGORY_LABELS: Record<string, string> = {
  motor: "Motor skills",
  strength_agility: "Strength & agility",
  technique: "Technique",
  with_ball: "With ball",
  without_ball: "Without ball",
  set_pieces: "Set pieces",
  defensive: "Defensive phase",
  attacking: "Attacking phase",
  transitions: "Transitions",
  attitude: "Attitude",
  final_comment: "Final comment",
}

export default function ScoutsTable() {
  const supabase = createClient()

  const [q, setQ] = useState("")
  const [rolesFilter, setRolesFilter] = useState<{ scout: boolean; scout_agent: boolean; admin: boolean }>({
    scout: false,
    scout_agent: false,
    admin: false,
  })
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Scout[]>([])
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const debounceRef = useRef<number | null>(null)

  // ---- Add User dialog state ----
  const [addOpen, setAddOpen] = useState(false)
  const [addEmail, setAddEmail] = useState("")
  const [addName, setAddName] = useState("")
  const [addRole, setAddRole] = useState<Role>("scout")
  const [addActive, setAddActive] = useState(true)
  const [adding, setAdding] = useState(false)

  // ---- Insights modal state ----
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [insightsBusy, setInsightsBusy] = useState(false)
  const [currentScout, setCurrentScout] = useState<Scout | null>(null)

  const [profile, setProfile] = useState<{ phone?: string | null; whatsapp?: string | null; agency?: string | null; country?: string | null } | null>(null)
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [overallAvg, setOverallAvg] = useState<number | null>(null)
  const [potentialAvg, setPotentialAvg] = useState<number | null>(null)
  const [avgByCat, setAvgByCat] = useState<Record<string, { avg: number; count: number }>>({})

  const [playersAdded, setPlayersAdded] = useState<PlayerLite[]>([])
  const [entriesAdded, setEntriesAdded] = useState<PlayerLite[]>([])
  const [myPlayers, setMyPlayers] = useState<PlayerLite[]>([])
  const [sessions, setSessions] = useState<Array<{ id: string; title: string | null; match_date: string; competition: string | null; opponent: string | null; players_count?: number }>>([])

  const [noteCatFilter, setNoteCatFilter] = useState<string | "all">("all")

  const selectedRoleParam = (): Role | undefined => {
    const selected: Role[] = []
    if (rolesFilter.scout) selected.push("scout")
    if (rolesFilter.scout_agent) selected.push("scout_agent")
    if (rolesFilter.admin) selected.push("admin")
    return selected.length === 1 ? selected[0] : undefined
  }

  const load = async () => {
    setLoading(true)
    try {
      const url = new URL("/api/admin/scouts/list", location.origin)
      if (q.trim()) url.searchParams.set("q", q.trim())
      const role = selectedRoleParam()
      if (role) url.searchParams.set("role", role)
      const res = await fetch(url.toString(), { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load scouts")
      setRows(json.scouts || [])
    } catch (e: any) {
      toast.error(e.message)
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // initial
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // refetch on role filter change
  useEffect(() => { load() }, [rolesFilter.scout, rolesFilter.scout_agent, rolesFilter.admin]) // eslint-disable-line react-hooks/exhaustive-deps
  // debounced search
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => load(), 300)
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const filtered = useMemo(() => rows, [rows])

  const toggleActive = async (id: string, next: boolean) => {
    if (pending[id]) return
    setPending(s => ({ ...s, [id]: true }))
    try {
      const res = await fetch("/api/admin/scouts/toggle-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scout_id: id, is_active: next }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Failed to update")
      setRows(list => list.map(s => (s.id === id ? { ...s, is_active: next } : s)))
      toast.success(next ? "Scout activated" : "Scout deactivated")
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setPending(s => ({ ...s, [id]: false }))
    }
  }

  const setRoleFor = async (id: string, role: Role) => {
    if (pending[id]) return
    setPending(s => ({ ...s, [id]: true }))
    try {
      const res = await fetch("/api/admin/scouts/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scout_id: id, role }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Failed to update role")
      setRows(list => list.map(s => (s.id === id ? { ...s, role } : s)))
      toast.success(
        role === "admin" ? "Promoted to admin" :
        role === "scout_agent" ? "Set to agent" :
        "Set to scout"
      )
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setPending(s => ({ ...s, [id]: false }))
    }
  }

  const resetFilters = () => {
    setQ("")
    setRolesFilter({ scout: false, scout_agent: false, admin: false })
    load()
  }

  // ---- Add user submit ----
  const submitAdd = async () => {
    if (!addEmail.trim()) {
      toast.error("Email is required")
      return
    }
    setAdding(true)
    try {
      const res = await fetch("/api/admin/scouts/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: addEmail.trim(),
          full_name: addName.trim(),
          role: addRole,
          is_active: addActive,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Failed to invite user")
      toast.success("Invite sent")
      setAddOpen(false)
      setAddEmail("")
      setAddName("")
      setAddRole("scout")
      setAddActive(true)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setAdding(false)
    }
  }

// -------- INSIGHTS LOADER (fetches everything needed) --------
const openInsights = async (scout: Scout) => {
  setCurrentScout(scout)
  setInsightsOpen(true)
  setInsightsBusy(true)
  try {
    const scoutId = scout.id

    // 1) Profile/contact
    const profileQ = supabase
      .from("profiles")
      .select("phone, whatsapp, agency, country")
      .eq("id", scoutId)
      .maybeSingle()

    // 2) Notes (with player)
    const notesQ = supabase
      .from("scout_notes")
      .select("category, rating, comment, created_at, players(id, full_name, image_url)")
      .eq("scout_id", scoutId)
      .order("created_at", { ascending: false })
      .limit(400)

    // 3) Canonical players created by this scout
    const createdPlayersQ = supabase
      .from("players")
      .select("id, full_name, image_url, main_position, current_club_name")
      .eq("created_by", scoutId)
      .order("created_at", { ascending: false })
      .limit(24)

    // 4) Player ENTRIES created by this scout
    const createdEntriesQ = supabase
      .from("scout_player_entries")
      .select("id, full_name, image_url, main_position, current_club_name")
      .eq("scout_id", scoutId)
      .order("created_at", { ascending: false })
      .limit(24)

    // 5) My players (assignment table)
    const myPlayersQ = supabase
      .from("players_scouts")
      .select("player_id, players(id, full_name, image_url, main_position, current_club_name)")
      .eq("scout_id", scoutId)
      .order("created_at", { ascending: false })
      .limit(24)

    // 6) Sessions
    const sessionsQ = supabase
      .from("observation_sessions")
      .select("id, title, match_date, competition, opponent")
      .eq("scout_id", scoutId)
      .order("match_date", { ascending: false })
      .limit(15)

    // 7) Potential rating avg (evaluations)
    const evalQ = supabase
      .from("evaluations")
      .select("potential_rating")
      .eq("scout_id", scoutId)
      .not("potential_rating", "is", null)
      .limit(600)

    const [
      { data: prof },
      { data: notesRows },
      { data: createdPlayers },
      { data: createdEntries },
      { data: myPlayersRows },
      { data: sessionsRows },
      { data: evalRows },
    ] = await Promise.all([profileQ, notesQ, createdPlayersQ, createdEntriesQ, myPlayersQ, sessionsQ, evalQ])

    setProfile(prof || null)

    // 🔧 Normalize notes shape to match NoteRow (players is a single object, not an array)
    const normalizedNotes: NoteRow[] = ((notesRows ?? []) as any[]).map((n) => {
      const raw = n?.players
      const one =
        raw == null
          ? null
          : Array.isArray(raw)
          ? raw[0] ?? null
          : raw

      return {
        category: String(n?.category ?? ""),
        rating: n?.rating != null ? Number(n.rating) : null,
        comment: n?.comment ?? null,
        created_at: String(n?.created_at ?? ""),
        players: one
          ? {
              id: String(one.id),
              full_name: String(one.full_name),
              image_url: one.image_url ?? null,
            }
          : null,
      }
    })

    setNotes(normalizedNotes)

    // averages
    const ratings: number[] = []
    const catAgg: Record<string, { sum: number; count: number }> = {}
    normalizedNotes.forEach((n) => {
      const r = Number(n.rating)
      if (Number.isFinite(r) && r > 0) {
        ratings.push(r)
        const k = n.category
        if (!catAgg[k]) catAgg[k] = { sum: 0, count: 0 }
        catAgg[k].sum += r
        catAgg[k].count += 1
      }
    })
    const round1 = (x: number) => Math.round(x * 10) / 10
    setOverallAvg(ratings.length ? round1(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null)
    const byCat: Record<string, { avg: number; count: number }> = {}
    Object.entries(catAgg).forEach(([k, v]) => (byCat[k] = { avg: round1(v.sum / v.count), count: v.count }))
    setAvgByCat(byCat)

    // players lists
    setPlayersAdded(
      (createdPlayers || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        image_url: p.image_url,
        main_position: p.main_position,
        current_club_name: p.current_club_name,
      }))
    )

    setEntriesAdded(
      (createdEntries || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        image_url: p.image_url,
        main_position: p.main_position,
        current_club_name: p.current_club_name,
      }))
    )

    setMyPlayers(
      (myPlayersRows || [])
        .map((r: any) => ({
          id: r.players?.id,
          full_name: r.players?.full_name,
          image_url: r.players?.image_url,
          main_position: r.players?.main_position,
          current_club_name: r.players?.current_club_name,
        }))
        .filter((p: any) => p.id)
    )

    // sessions + players_count
    const sess = (sessionsRows as any) || []
    if (sess.length) {
      const { data: members } = await supabase
        .from("observation_players")
        .select("observation_id")
        .in("observation_id", sess.map((s: any) => s.id))

      const counts: Record<string, number> = {}
      ;(members || []).forEach((m: any) => {
        counts[m.observation_id] = (counts[m.observation_id] || 0) + 1
      })
      setSessions(sess.map((s: any) => ({ ...s, players_count: counts[s.id] || 0 })))
    } else {
      setSessions([])
    }

    // potential avg
    const potentials = (evalRows || [])
      .map((e: any) => Number(e.potential_rating))
      .filter((n) => Number.isFinite(n) && n > 0)

    setPotentialAvg(potentials.length ? round1(potentials.reduce((a, b) => a + b, 0) / potentials.length) : null)
  } catch (e: any) {
    console.error(e)
    toast.error(e?.message || "Failed to load insights")
  } finally {
    setInsightsBusy(false)
  }
}


  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search name, agency, country…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load() }}
          />
        </div>

        {/* Role filter */}
        <div className="flex flex-wrap items-center gap-4 rounded-md border px-3 py-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="role-scout"
              checked={rolesFilter.scout}
              onCheckedChange={(v) => setRolesFilter(r => ({ ...r, scout: Boolean(v) }))}
            />
            <Label htmlFor="role-scout" className="text-sm">Scout</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="role-agent"
              checked={rolesFilter.scout_agent}
              onCheckedChange={(v) => setRolesFilter(r => ({ ...r, scout_agent: Boolean(v) }))}
            />
            <Label htmlFor="role-agent" className="text-sm">Agent</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="role-admin"
              checked={rolesFilter.admin}
              onCheckedChange={(v) => setRolesFilter(r => ({ ...r, admin: Boolean(v) }))}
            />
            <Label htmlFor="role-admin" className="text-sm">Admin</Label>
          </div>
          <span className="ml-2 text-xs text-muted-foreground">
            (Select exactly one to filter; none or multiple = all)
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={resetFilters} disabled={loading}>
            Reset
          </Button>
          <Button onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</Button>

          {/* Add User */}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add user</DialogTitle>
                <DialogDescription>
                  Send an email invite and set initial role/profile.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="add-email">Email</Label>
                  <Input
                    id="add-email"
                    type="email"
                    placeholder="name@example.com"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="add-name">Full name (optional)</Label>
                  <Input
                    id="add-name"
                    placeholder="Full name"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="add-role">Role</Label>
                  <select
                    id="add-role"
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as Role)}
                  >
                    <option value="scout">Scout</option>
                    <option value="scout_agent">Agent</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="mt-1 flex items-center gap-2">
                  <Checkbox
                    id="add-active"
                    checked={addActive}
                    onCheckedChange={(v) => setAddActive(Boolean(v))}
                  />
                  <Label htmlFor="add-active">Active</Label>
                </div>
              </div>

              <DialogFooter className="mt-2">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={submitAdd} disabled={adding}>
                  {adding ? "Sending…" : "Send invite"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Grid list */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map(s => {
          const isBusy = !!pending[s.id]

          return (
            <Card key={s.id} className="flex gap-3 rounded-2xl p-4 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.avatar_url || "/placeholder.svg"}
                alt={s.full_name ?? "Scout"}
                className="h-14 w-14 rounded-full border object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate font-medium">{s.full_name ?? "(no name)"}</div>
                  {s.role === "admin" ? (
                    <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" /> Admin</Badge>
                  ) : s.role === "scout_agent" ? (
                    <Badge variant="outline">Agent</Badge>
                  ) : (
                    <Badge variant="outline">Scout</Badge>
                  )}
                  {!s.is_active && <Badge variant="destructive">Inactive</Badge>}
                </div>

                <div className="truncate text-xs text-muted-foreground">
                  {s.agency || "—"}{s.country ? ` · ${s.country}` : ""}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  My Players: {s.myPlayersCount} · Entries: {s.entriesCount}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`role-select-${s.id}`} className="text-sm">Role</Label>
                    <select
                      id={`role-select-${s.id}`}
                      className="h-8 rounded-md border bg-background px-2 text-sm"
                      value={s.role}
                      disabled={isBusy}
                      onChange={(e) => setRoleFor(s.id, e.target.value as Role)}
                    >
                      <option value="scout">Scout</option>
                      <option value="scout_agent">Agent</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openInsights(s)}
                    >
                      Insights
                    </Button>
                    <Button
                      variant={s.is_active ? "outline" : "default"}
                      size="sm"
                      className="h-8"
                      disabled={isBusy}
                      onClick={() => toggleActive(s.id, !s.is_active)}
                    >
                      {s.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}

        {!filtered.length && (
          <Card className="col-span-full rounded-2xl p-8 text-center text-sm text-muted-foreground shadow-sm">
            No scouts found.
          </Card>
        )}
      </div>

      {/* ---------- INSIGHTS MODAL ---------- */}
      <Dialog open={insightsOpen} onOpenChange={setInsightsOpen}>
        <DialogContent className="max-h-[85vh] w-[96vw] max-w-6xl overflow-hidden p-0">
          {/* Sticky header */}
          <header className="sticky top-0 z-10 border-b bg-background/80 p-4 backdrop-blur">
            <DialogHeader className="p-0">
              <DialogTitle className="flex items-center gap-3 text-base sm:text-lg">
                {currentScout?.avatar_url
                  ? <img src={currentScout.avatar_url} alt="" className="h-8 w-8 rounded-full border object-cover" />
                  : <div className="h-8 w-8 rounded-full bg-muted" />
                }
                <span className="truncate">{currentScout?.full_name || "Scout"}</span>
                {currentScout?.role === "admin"
                  ? <Badge variant="secondary" className="ml-1">Admin</Badge>
                  : currentScout?.role === "scout_agent"
                    ? <Badge variant="outline" className="ml-1">Agent</Badge>
                    : <Badge variant="outline" className="ml-1">Scout</Badge>}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Notes, players, and observation activity.
              </DialogDescription>
            </DialogHeader>

            {/* Stat strip */}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Overall avg" value={overallAvg != null ? `${overallAvg}/10` : "—"} />
              <Stat label="Potential avg" value={potentialAvg != null ? `${potentialAvg}/10` : "—"} />
              <Stat label="Notes" value={String(notes.length)} />
              <Stat label="Sessions" value={String(sessions.length)} />
            </div>
          </header>

          <div className="flex-1 overflow-auto p-4">
            {insightsBusy ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading insights…
              </div>
            ) : (
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="players">Players</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  <TabsTrigger value="sessions">Observations</TabsTrigger>
                </TabsList>

                {/* OVERVIEW */}
                <TabsContent value="overview" className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-3">
                    <Card className="space-y-3 p-4">
                      <div className="text-sm font-medium">Contact</div>
                      <div className="text-xs text-muted-foreground">
                        <div>Agency: {profile?.agency || "—"}</div>
                        <div>Country: {profile?.country || "—"}</div>
                        <div>Phone: {profile?.phone || "—"}</div>
                        <div>WhatsApp: {profile?.whatsapp || "—"}</div>
                      </div>
                    </Card>

                    <Card className="lg:col-span-2 space-y-3 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">Notes overview</div>
                        <div className="text-xs text-muted-foreground">per category</div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(CATEGORY_LABELS).map(([k, label]) => {
                          const row = avgByCat[k]
                          return (
                            <div key={k} className="flex items-center justify-between rounded-md border px-2 py-1.5">
                              <div className="truncate text-xs">{label}</div>
                              <div className="text-xs text-muted-foreground">
                                {row ? `${row.avg}/10 · ${row.count}` : "—"}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </Card>
                  </div>
                </TabsContent>

                {/* PLAYERS */}
                <TabsContent value="players" className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="space-y-3 p-4">
                      <div className="text-sm font-medium">Added players (canonicals)</div>
                      {playersAdded.length === 0 ? (
                        <div className="text-xs text-muted-foreground">None.</div>
                      ) : (
                        <PeopleGrid items={playersAdded} />
                      )}
                    </Card>

                    <Card className="space-y-3 p-4">
                      <div className="text-sm font-medium">Submitted entries</div>
                      {entriesAdded.length === 0 ? (
                        <div className="text-xs text-muted-foreground">None.</div>
                      ) : (
                        <PeopleGrid items={entriesAdded} entryTag />
                      )}
                    </Card>

                    <Card className="lg:col-span-2 space-y-3 p-4">
                      <div className="text-sm font-medium">My players (assigned)</div>
                      {myPlayers.length === 0 ? (
                        <div className="text-xs text-muted-foreground">None assigned.</div>
                      ) : (
                        <PeopleGrid items={myPlayers} />
                      )}
                    </Card>
                  </div>
                </TabsContent>

                {/* NOTES */}
                <TabsContent value="notes" className="space-y-4">
                  <Card className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium">Recent notes (by player)</div>
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          className={`rounded-md border px-2 py-1 text-xs ${noteCatFilter === "all" ? "bg-accent" : ""}`}
                          onClick={() => setNoteCatFilter("all")}
                        >
                          All
                        </button>
                        {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                          <button
                            key={k}
                            className={`rounded-md border px-2 py-1 text-xs ${noteCatFilter === k ? "bg-accent" : ""}`}
                            onClick={() => setNoteCatFilter(k)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Separator className="my-3" />

                    {(() => {
                      const filteredNotes = noteCatFilter === "all" ? notes : notes.filter(n => n.category === noteCatFilter)
                      const byPlayer = new Map<string, { player: PlayerLite; notes: NoteRow[] }>()
                      filteredNotes.forEach((n) => {
                        const pid = n.players?.id || "unknown"
                        const pInfo: PlayerLite = {
                          id: pid,
                          full_name: n.players?.full_name || "Unknown player",
                          image_url: n.players?.image_url || null,
                        }
                        if (!byPlayer.has(pid)) byPlayer.set(pid, { player: pInfo, notes: [] })
                        byPlayer.get(pid)!.notes.push(n)
                      })
                      const groups = Array.from(byPlayer.values())

                      return groups.length ? (
                        <div className="grid gap-3">
                          {groups.map(g => (
                            <div key={g.player.id} className="rounded-xl border p-3">
                              <div className="mb-2 flex items-center gap-2">
                                <img src={g.player.image_url || "/placeholder.svg"} alt={g.player.full_name} className="h-8 w-8 rounded-md border object-cover" />
                                <div className="text-sm font-medium">{g.player.full_name}</div>
                                <Badge variant="outline" className="ml-auto">{g.notes.length} notes</Badge>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {g.notes.slice(0, 8).map((n, i) => (
                                  <div key={i} className="rounded-md border bg-background px-2 py-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="font-medium">{CATEGORY_LABELS[n.category] || n.category}</span>
                                      <span className="text-muted-foreground">{n.rating ?? "—"}/10</span>
                                    </div>
                                    {n.comment && <div className="mt-1 text-xs">{n.comment}</div>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">No notes for this filter.</div>
                      )
                    })()}
                  </Card>
                </TabsContent>

                {/* SESSIONS */}
                <TabsContent value="sessions" className="space-y-4">
                  <Card className="space-y-3 p-4">
                    <div className="text-sm font-medium">Recent observations</div>
                    {!sessions.length ? (
                      <div className="text-xs text-muted-foreground">No sessions yet.</div>
                    ) : (
                      <div className="grid gap-2">
                        {sessions.map(s => (
                          <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {s.match_date}{s.title ? ` · ${s.title}` : ""}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {s.competition || "—"}{s.opponent ? ` · vs ${s.opponent}` : ""}{typeof s.players_count === "number" ? ` · ${s.players_count} players` : ""}
                              </div>
                            </div>
                            <Button asChild size="sm" variant="outline">
                              <a href={`/scout/observations/${s.id}`} className="text-xs">
                                Open <ExternalLink className="ml-1 h-3.5 w-3.5" />
                              </a>
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>

          <div className="border-t p-3 text-right">
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ------------ tiny helpers ------------ */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}

function PeopleGrid({ items, entryTag = false }: { items: PlayerLite[]; entryTag?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {items.map(p => (
        <div key={p.id} className="flex items-center gap-2 rounded-md border p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.image_url || "/placeholder.svg"} alt={p.full_name} className="h-8 w-8 rounded-md border object-cover" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{p.full_name}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {entryTag ? <Badge variant="outline" className="mr-1 px-1 py-0">Entry</Badge> : null}
              {p.main_position || "—"}{p.current_club_name ? ` · ${p.current_club_name}` : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
