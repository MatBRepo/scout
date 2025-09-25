"use client"
import Link from "next/link"
import { useEffect, useMemo, useState, useRef, useCallback  } from "react"
import type { Row } from "./page"
import { createClient } from "@/lib/supabase/browser"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table"
import {
  ExternalLink,
  ExternalLink as ExtLinkIcon, 
  PlusCircle,
  Loader2,
  CheckCircle2,
  FileText,
  Mic,
  Filter,
  SortAsc,
  SortDesc,
  Trash2,
  LayoutGrid,
  Rows,
  RotateCcw,
  Trash,
  Search,
  ListFilter,
  GitBranch,      
  ZoomIn,       
  ZoomOut,      
  Minimize2,
  X,
} from "lucide-react"
// shadcn dialog
import { cn } from "@/lib/utils"
// add DialogClose to your import:
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose
} from "@/components/ui/dialog"

import dynamic from 'next/dynamic'
import PlayersGraphFlow, { type GraphApi } from '@/components/visual/PlayersGraphFlow'
import { X as XIcon } from "lucide-react"


        const Graph = dynamic(() => import('@/components/visual/PlayersGraphFlow'), { ssr: false })

        type VisualTreeModalProps = {
          open: boolean
          onOpenChange: (v: boolean) => void
          players: Row[]
          notesByPlayer: Record<string, NoteAgg>
          voicesByPlayer: Record<string, number>
          existingByPlayer: Record<string, Set<string>>
}

function VisualTreeModal({
  open,
  onOpenChange,
  players,
  notesByPlayer,
  voicesByPlayer,
  existingByPlayer,
}: VisualTreeModalProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Row | null>(null)
  const apiRef = useRef<GraphApi | null>(null)

  // Stable handlers
  const zoomIn = useCallback(() => apiRef.current?.zoomIn(), [])
  const zoomOut = useCallback(() => apiRef.current?.zoomOut(), [])
  const fit = useCallback(() => apiRef.current?.fit(), [])
  const relayout = useCallback(() => {
    // Simple "relayout": rebuild fit (React Flow doesn't mutate positions automatically)
    apiRef.current?.fit()
  }, [])

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) setSelectedPlayer(null)
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="fixed left-1/2 top-1/2 z-50 grid h-[100dvh] w-[100vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden  p-0 sm:max-w-[100vw]"
      >
        {/* Header */}
        <div className="flex max-h-[100px] items-center justify-between border-b px-3 py-2">
          <DialogHeader className="flex-1">
            <DialogTitle className="truncate text-base font-semibold">Visual view — My Players</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={zoomIn} title="Zoom in">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={zoomOut} title="Zoom out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={fit} title="Fit to screen">
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={relayout} title="Relayout">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" aria-label="Close">
                <XIcon className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </div>

        {/* Body */}
        <div
          className="grid grid-cols-1 md:grid-cols-[1fr_360px]"
          style={{ height: '100vh' }}   // <- add this
        >
          <div className="relative">
            {/* Optional floating controls (in addition to header/Controls component) */}
            <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md border bg-background/85 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur">
              Click a player node for details. Drag to pan. Scroll to zoom.
            </div>

            <Graph
              players={players}
              selectedId={selectedPlayer?.id ?? null}
              onSelect={(row) => setSelectedPlayer(row as Row | null)}
              setApi={(api) => {
                apiRef.current = api
              }}
            />
          </div>

          {/* Side panel */}
          <aside className="hidden border-l bg-card/40 md:block">
            <div className="h-full overflow-y-auto p-4">
              {selectedPlayer ? (
                <>
                  <div className="flex items-start gap-3">
                    <PlayerAvatar src={selectedPlayer.image_url} alt={selectedPlayer.full_name} />
                    <div className="min-w-0">
                      <div className="text-lg font-semibold leading-tight">{selectedPlayer.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedPlayer.main_position || '—'}
                        {selectedPlayer.current_club_name ? ` · ${selectedPlayer.current_club_name}` : ''}
                        {selectedPlayer.current_club_country ? ` (${selectedPlayer.current_club_country})` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <Card className="p-3">
                      <div className="text-xs text-muted-foreground">Notes</div>
                      <div className="text-base font-semibold">{notesByPlayer[selectedPlayer.id]?.count ?? 0}</div>
                    </Card>
                    <Card className="p-3">
                      <div className="text-xs text-muted-foreground">Avg</div>
                      <div className="text-base font-semibold">{notesByPlayer[selectedPlayer.id]?.avg ?? '—'}/10</div>
                    </Card>
                    <Card className="p-3">
                      <div className="text-xs text-muted-foreground">Voice notes</div>
                      <div className="text-base font-semibold">{voicesByPlayer[selectedPlayer.id] ?? 0}</div>
                    </Card>
                    <Card className="p-3">
                      <div className="text-xs text-muted-foreground">Observations</div>
                      <div className="text-base font-semibold">
                        {existingByPlayer[selectedPlayer.id]?.size ?? 0}
                      </div>
                    </Card>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild>
                      <Link href={`/scout/players/${selectedPlayer.id}`}>Open profile</Link>
                    </Button>
                    {selectedPlayer.transfermarkt_url && (
                      <Button asChild variant="outline">
                        <a href={selectedPlayer.transfermarkt_url} target="_blank" rel="noreferrer">
                          Transfermarkt <ExtLinkIcon className="ml-1 h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">
                  Click a player to see details
                </div>
              )}
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}



type TreeNode =
  | { id: string; name: string; depth: 0; children: TreeNode[] }
  | { id: string; name: string; depth: 1; children: TreeNode[] }
  | { id: string; name: string; depth: 2; children: TreeNode[] }
  | { id: string; name: string; depth: 3; player: Row }

type Session = { id: string; title: string | null; match_date: string }
type NoteRow = {
  player_id: string
  rating: number | null
  category: string
  comment: string | null
  created_at: string
}
type NoteAgg = {
  count: number
  avg: number | null
  last: Array<Pick<NoteRow, "category" | "rating" | "comment" | "created_at">>
}
const CATEGORY_LABELS: Record<string, string> = {
  motor: "Motor skills",
  strength_agility: "Strength & agility",
  technique: "Technique",
  with_ball: "With ball",
  without_ball: "Without ball",
  set_pieces: "Set pieces",
  defensive: "Defensive",
  attacking: "Attacking",
  transitions: "Transitions",
  attitude: "Attitude",
  final_comment: "Final comment",
}
type SortKey = "alpha" | "notes" | "avg" | "recent"
type ViewMode = "grid" | "table"
type TabKey = "players" | "trash"
type TrashItem = {
  player_id: string
  scout_id: string
  removed_at: string
  snapshot?: {
    id: string
    full_name?: string
    image_url?: string | null
    main_position?: string | null
    current_club_name?: string | null
    current_club_country?: string | null
    transfermarkt_url?: string | null
  }
}
export default function MyPlayersClient({ rows }: { rows: Row[] }) {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [visualOpen, setVisualOpen] = useState(false)

  // Live players list
  const [localItems, setLocalItems] = useState<Row[]>(rows ?? [])
  const [loadingPlayers, setLoadingPlayers] = useState(!(rows && rows.length))
  useEffect(() => {
    if (localItems.length) { setLoadingPlayers(false); return } // SSR provided rows
    let mounted = true
    ;(async () => {
      try {
        setLoadingPlayers(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { if (mounted) setLoadingPlayers(false); return }
        const { data: links } = await supabase
          .from("players_scouts")
          .select("player_id, created_at")
          .eq("scout_id", user.id)
          .order("created_at", { ascending: false })
        const ids = (links ?? []).map(l => l.player_id)
        if (!ids.length) { if (mounted) setLoadingPlayers(false); return }
        const { data: players } = await supabase
          .from("players")
          .select("id, full_name, main_position, current_club_name, current_club_country, image_url, transfermarkt_url")
          .in("id", ids)
        if (!mounted) return
        const byId = new Map((players ?? []).map(p => [p.id, p]))
        setLocalItems(ids.map(id => byId.get(id)).filter(Boolean) as Row[])
      } catch (e) {
        console.error(e)
      } finally {
        if (mounted) setLoadingPlayers(false)
      }
    })()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Sessions
  const [sessions, setSessions] = useState<Session[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  // Observation membership + add
  const [existingByPlayer, setExistingByPlayer] = useState<Record<string, Set<string>>>({})
  const [selectedByPlayer, setSelectedByPlayer] = useState<Record<string, string>>({})
  const [addingByPlayer, setAddingByPlayer] = useState<Record<string, boolean>>({})
  // Remove/restore
  const [removingByPlayer, setRemovingByPlayer] = useState<Record<string, boolean>>({})
  const [restoringByPlayer, setRestoringByPlayer] = useState<Record<string, boolean>>({})
  // Trash (persistent if table exists, otherwise localStorage)
  const [trashSupported, setTrashSupported] = useState<boolean>(true)
  const [trash, setTrash] = useState<TrashItem[]>([])
  // Notes/voices
  const [notesByPlayer, setNotesByPlayer] = useState<Record<string, NoteAgg>>({})
  const [voicesByPlayer, setVoicesByPlayer] = useState<Record<string, number>>({})
  // Filters/sorts/view/tabs
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("recent")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [onlyWithNotes, setOnlyWithNotes] = useState(false)
  const [view, setView] = useState<ViewMode>("table") // will flip to "grid" on mount for small screens
  const [activeTab, setActiveTab] = useState<TabKey>("players")
  const searchInputId = "myplayers-search"
  // On mount: prefer cards on phones
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setView("grid")
    }
  }, [])
  /* ---------- helpers for localStorage fallback ---------- */
  const lsKey = (uid: string) => `my_players_trash_${uid}`
  const saveTrashLocal = (uid: string, list: TrashItem[]) => {
    try { localStorage.setItem(lsKey(uid), JSON.stringify(list)) } catch {}
  }
  const loadTrashLocal = (uid: string) => {
    try {
      const raw = localStorage.getItem(lsKey(uid))
      return raw ? (JSON.parse(raw) as TrashItem[]) : []
    } catch { return [] }
  }
  /* ---------------- Boot: user + sessions + trash support ---------------- */
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        if (!mounted) return
        setUserId(user.id)
        // Try reading trash table to detect support
        const probe = await supabase
          .from("players_scouts_trash")
          .select("player_id")
          .eq("scout_id", user.id)
          .limit(1)
        if (probe.error) {
          setTrashSupported(false)
          setTrash(loadTrashLocal(user.id))
        } else {
          setTrashSupported(true)
          await reloadTrash(user.id)
        }
        // Sessions
        const { data, error } = await supabase
          .from("observation_sessions")
          .select("id, title, match_date")
          .eq("scout_id", user.id)
          .order("match_date", { ascending: false })
        if (error) throw error
        if (mounted) setSessions(data || [])
      } catch (e: any) {
        console.error(e)
        toast.error(e?.message || "Failed to initialize")
      } finally {
        if (mounted) setLoadingSessions(false)
      }
    })()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  /* ---------------- Membership map ---------------- */
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        if (!sessions.length || !localItems.length) return
        const sessionIds = sessions.map(s => s.id)
        const playerIds = localItems.map(i => i.id)
        const { data, error } = await supabase
          .from("observation_players")
          .select("observation_id, player_id")
          .in("observation_id", sessionIds)
          .in("player_id", playerIds)
        if (error) throw error
        const map: Record<string, Set<string>> = {}
        for (const row of data || []) {
          const pid = row.player_id as string
          const oid = row.observation_id as string
          if (!map[pid]) map[pid] = new Set()
          map[pid].add(oid)
        }
        if (mounted) setExistingByPlayer(map)
      } catch (e) {
        console.error(e)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, localItems.length])
  /* ---------------- Notes & voices aggregates ---------------- */
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !localItems.length) return
        const playerIds = localItems.map(i => i.id)
        const { data: noteRows, error: notesErr } = await supabase
          .from("scout_notes")
          .select("player_id, rating, category, comment, created_at")
          .eq("scout_id", user.id)
          .in("player_id", playerIds)
          .order("created_at", { ascending: false })
          .limit(2000)
        if (notesErr) throw notesErr
        const per: Record<string, NoteAgg> = {}
        ;(noteRows || []).forEach((n: NoteRow) => {
          const pid = n.player_id
          if (!per[pid]) per[pid] = { count: 0, avg: null, last: [] }
          per[pid].count += 1
          if (per[pid].last.length < 3) {
            per[pid].last.push({ category: n.category, rating: n.rating, comment: n.comment, created_at: n.created_at })
          }
        })
        const sums: Record<string, { sum: number; cnt: number }> = {}
        ;(noteRows || []).forEach((n: NoteRow) => {
          if (!Number.isFinite(n.rating) || !n.rating) return
          const pid = n.player_id
          if (!sums[pid]) sums[pid] = { sum: 0, cnt: 0 }
          sums[pid].sum += Number(n.rating)
          sums[pid].cnt += 1
        })
        Object.entries(sums).forEach(([pid, s]) => {
          const avg = s.cnt ? Math.round((s.sum / s.cnt) * 10) / 10 : null
          if (!per[pid]) per[pid] = { count: 0, avg: null, last: [] }
          per[pid].avg = avg
        })
        if (mounted) setNotesByPlayer(per)
        const { data: voiceRows, error: voiceErr } = await supabase
          .from("observation_voice_notes")
          .select("player_id")
          .eq("scout_id", user.id)
          .in("player_id", playerIds)
        if (voiceErr) throw voiceErr
        const vmap: Record<string, number> = {}
        ;(voiceRows || []).forEach((r: any) => {
          const pid = r.player_id as string
          vmap[pid] = (vmap[pid] || 0) + 1
        })
        if (mounted) setVoicesByPlayer(vmap)
      } catch (e) {
        console.error(e)
      }
    })()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localItems.length])
  /* ---------------- Trash load/help ---------------- */
  async function reloadTrash(uid?: string) {
    const scoutId = uid || userId
    if (!scoutId) return
    try {
      const { data, error } = await supabase
        .from("players_scouts_trash")
        .select("player_id, scout_id, removed_at, snapshot")
        .eq("scout_id", scoutId)
        .order("removed_at", { ascending: false })
      if (error) throw error
      setTrash(data as TrashItem[])
    } catch (e: any) {
      setTrashSupported(false)
      const ls = loadTrashLocal(scoutId)
      setTrash(ls)
    }
  }
  function setSelectedSession(playerId: string, sessionId: string) {
    setSelectedByPlayer(prev => ({ ...prev, [playerId]: sessionId }))
  }
  async function addToObservation(playerId: string) {
    const sessionId = selectedByPlayer[playerId]
    if (!sessionId) return toast.info("Choose observation session first")
    const alreadySet = existingByPlayer[playerId]?.has(sessionId)
    if (alreadySet) return toast.info("Player is already in this observation")
    setAddingByPlayer(prev => ({ ...prev, [playerId]: true }))
    try {
      const { error } = await supabase.from("observation_players").insert({
        observation_id: sessionId, player_id: playerId, minutes_watched: null, rating: null, notes: null,
      })
      if (error) throw error
      setExistingByPlayer(prev => {
        const next = { ...prev }
        const set = new Set(next[playerId] ?? [])
        set.add(sessionId)
        next[playerId] = set
        return next
      })
      toast.success("Player added to observation")
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || "Could not add player")
    } finally {
      setAddingByPlayer(prev => ({ ...prev, [playerId]: false }))
    }
  }
  /* ---------------- Remove: move to Trash ---------------- */
  async function removeFromMyPlayers(playerId: string) {
    if (!userId) return toast.error("Not signed in")
    if (removingByPlayer[playerId]) return
    const player = localItems.find(p => p.id === playerId)
    if (!player) return
    const ok = window.confirm(`Remove ${player.full_name} from My Players?`)
    if (!ok) return
    setRemovingByPlayer(prev => ({ ...prev, [playerId]: true }))
    try {
      const snapshot = {
        id: player.id,
        full_name: player.full_name,
        image_url: player.image_url,
        main_position: player.main_position,
        current_club_name: player.current_club_name,
        current_club_country: player.current_club_country,
        transfermarkt_url: player.transfermarkt_url,
      }
      if (trashSupported) {
        const { error: insErr } = await supabase
          .from("players_scouts_trash")
          .upsert({ scout_id: userId, player_id: playerId, snapshot })
        if (insErr) throw insErr
        await reloadTrash()
      } else {
        const next: TrashItem[] = [{ player_id: playerId, scout_id: userId, removed_at: new Date().toISOString(), snapshot }, ...trash]
        setTrash(next)
        saveTrashLocal(userId, next)
      }
      const { error } = await supabase.from("players_scouts").delete().eq("player_id", playerId).eq("scout_id", userId)
      if (error) throw error
      setLocalItems(prev => prev.filter(p => p.id !== playerId))
      setSelectedByPlayer(({ [playerId]: _, ...rest }) => rest)
      setAddingByPlayer(({ [playerId]: __, ...rest }) => rest)
      setExistingByPlayer(({ [playerId]: ___, ...rest }) => rest)
      setNotesByPlayer(({ [playerId]: ____, ...rest }) => rest)
      setVoicesByPlayer(({ [playerId]: _____, ...rest }) => rest)
      toast.success("Moved to Trash", { description: player.full_name })
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || "Failed to remove player")
    } finally {
      setRemovingByPlayer(prev => ({ ...prev, [playerId]: false }))
    }
  }
  /* ---------------- Restore from Trash ---------------- */
  async function restoreFromTrash(item: TrashItem) {
    if (!userId) return
    const pid = item.player_id
    if (restoringByPlayer[pid]) return
    setRestoringByPlayer(prev => ({ ...prev, [pid]: true }))
    try {
      const { error: upErr } = await supabase
        .from("players_scouts")
        .upsert([{ player_id: pid, scout_id: userId }], { onConflict: "scout_id,player_id" })
      if (upErr) throw upErr
      if (trashSupported) {
        const { error: delErr } = await supabase
          .from("players_scouts_trash")
          .delete()
          .eq("scout_id", userId)
          .eq("player_id", pid)
        if (delErr) throw delErr
        await reloadTrash()
      } else {
        const next = trash.filter(t => !(t.player_id === pid && t.scout_id === userId))
        setTrash(next)
        saveTrashLocal(userId, next)
      }
      const { data: pr, error: prErr } = await supabase
        .from("players")
        .select("id, full_name, main_position, current_club_name, current_club_country, image_url, transfermarkt_url")
        .eq("id", pid)
        .single()
      const addRow: Row =
        pr && !prErr
          ? (pr as Row)
          : {
              id: item.snapshot?.id ?? pid,
              full_name: item.snapshot?.full_name ?? "Player",
              main_position: item.snapshot?.main_position ?? null,
              current_club_name: item.snapshot?.current_club_name ?? null,
              current_club_country: item.snapshot?.current_club_country ?? null,
              image_url: item.snapshot?.image_url ?? null,
              transfermarkt_url: item.snapshot?.transfermarkt_url ?? null,
            }
      setLocalItems(prev => {
        const exists = prev.some(p => p.id === pid)
        return exists ? prev : [addRow, ...prev]
      })
      toast.success("Restored", { description: addRow.full_name })
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || "Could not restore player")
    } finally {
      setRestoringByPlayer(prev => ({ ...prev, [pid]: false }))
    }
  }
  /* ---------------- Empty trash ---------------- */
  async function emptyTrash() {
    if (!userId) return
    const ok = window.confirm("Permanently delete all items from Trash?")
    if (!ok) return
    try {
      if (trashSupported) {
        const { error } = await supabase
          .from("players_scouts_trash")
          .delete()
          .eq("scout_id", userId)
        if (error) throw error
        await reloadTrash()
      } else {
        setTrash([])
        saveTrashLocal(userId, [])
      }
      toast.success("Trash emptied")
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || "Failed to empty trash")
    }
  }
  /* ---------------- Derived lists ---------------- */
  const headerStats = useMemo(() => {
    const totals = localItems.reduce(
      (acc, p) => {
        const agg = notesByPlayer[p.id]
        if (agg?.count) {
          acc.notes += agg.count
          if (Number.isFinite(agg.avg) && agg.avg != null) {
            acc.sumRatings += agg.avg!
            acc.playersWithAvg += 1
          }
        }
        acc.voices += voicesByPlayer[p.id] || 0
        return acc
      },
      { notes: 0, voices: 0, sumRatings: 0, playersWithAvg: 0 }
    )
    const overallAvg =
      totals.playersWithAvg > 0 ? Math.round((totals.sumRatings / totals.playersWithAvg) * 10) / 10 : null
    return { totalPlayers: localItems.length, totalNotes: totals.notes, totalVoices: totals.voices, overallAvg }
  }, [localItems, notesByPlayer, voicesByPlayer])
  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = localItems.filter(p => {
      const okSearch =
        !q ||
        p.full_name.toLowerCase().includes(q) ||
        (p.current_club_name || "").toLowerCase().includes(q) ||
        (p.main_position || "").toLowerCase().includes(q)
      const okNotes = !onlyWithNotes || !!notesByPlayer[p.id]?.count
      return okSearch && okNotes
    })
    list = list.slice().sort((a, b) => {
      const A = notesByPlayer[a.id]
      const B = notesByPlayer[b.id]
      switch (sortKey) {
        case "alpha": {
          const cmp = a.full_name.localeCompare(b.full_name)
          return sortDir === "asc" ? cmp : -cmp
        }
        case "notes": {
          const cmp = (B?.count || 0) - (A?.count || 0)
          return sortDir === "asc" ? -cmp : cmp
        }
        case "avg": {
          const cmp = (B?.avg ?? -Infinity) - (A?.avg ?? -Infinity)
          return sortDir === "asc" ? -cmp : cmp
        }
        case "recent": {
          const aT = A?.last?.[0]?.created_at ? Date.parse(A.last[0].created_at) : 0
          const bT = B?.last?.[0]?.created_at ? Date.parse(B.last[0].created_at) : 0
          const cmp = bT - aT
          return sortDir === "asc" ? -cmp : cmp
        }
        default:
          return 0
      }
    })
    return list
  }, [localItems, search, onlyWithNotes, sortKey, sortDir, notesByPlayer])
  /* ---------------- Empty state ---------------- */
  if (!localItems.length && !trash.length && !loadingPlayers) {
    return (
      <div className="w-full space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">My Players</h1>
        </div>
        <Separator />
        <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
          No players yet. Add one from <span className="font-medium">Discover</span> or via{" "}
          <span className="font-medium">Add Player</span>.
        </Card>
      </div>
    )
  }
  /* ---------------- Render ---------------- */
  return (
    <div className="w-full space-y-4">
      {/* Title + counters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold pb-2 md:pb-4">My Players</h1>
            {loadingPlayers && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading players" />}
          </div>
          {/* counters as scrollable chips on mobile */}
          <div className="mt-1 -mx-1 overflow-x-auto md:mx-0 md:overflow-visible">
            <div
              className="flex w-full min-w-0 gap-2 px-1 pb-1 text-xs text-muted-foreground
                         md:flex-wrap md:px-0 md:pb-0
                         [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <Badge variant="secondary" className="shrink-0">Players: {headerStats.totalPlayers}</Badge>
              <Badge variant="outline" className="shrink-0 gap-1"><FileText className="h-3 w-3" /> {headerStats.totalNotes}</Badge>
              <Badge variant="outline" className="shrink-0 gap-1"><Mic className="h-3 w-3" /> {headerStats.totalVoices}</Badge>
              <Badge variant="outline" className="shrink-0">Avg: {headerStats.overallAvg ?? "—"}/10</Badge>
              <Badge variant="outline" className="shrink-0 gap-1"><Trash className="h-3 w-3" /> {trash.length}</Badge>
            </div>
          </div>
        </div>
      </div>
      {/* Secondary nav (sticky): tabs + controls */}
      <div
        className="sticky top-[calc(env(safe-area-inset-top)+4px)] z-30
                   rounded-xl border bg-background/80 backdrop-blur p-2
                   md:rounded-none md:border-0 md:bg-transparent md:backdrop-blur-0 md:px-0 md:py-0"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          {/* Segmented tabs */}
          <div className="inline-flex rounded-lg border p-1 bg-background">
            <Button
              type="button"
              size="sm"
              variant={activeTab === "players" ? "secondary" : "ghost"}
              className="h-9 md:h-8 px-3"
              onClick={() => setActiveTab("players")}
            >
              Players
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeTab === "trash" ? "secondary" : "ghost"}
              className="h-9 md:h-8 px-3"
              onClick={() => setActiveTab("trash")}
            >
              Trash ({trash.length})
            </Button>
            <Button
  type="button"
  size="sm"
  className="h-9 md:h-8"
  onClick={() => setVisualOpen(true)}
>
  <GitBranch className="mr-1 h-4 w-4" />
  Visual view
</Button>
          </div>
          {/* Controls */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id={searchInputId}
              placeholder="Search by name, club, position…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64"
              aria-label="Search my players"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={onlyWithNotes ? "secondary" : "outline"}
                size="sm"
                onClick={() => setOnlyWithNotes(v => !v)}
                title="Toggle only players with notes"
                className="h-9 md:h-8"
              >
                <Filter className="mr-1 h-4 w-4" />
                {onlyWithNotes ? "With notes" : "All"}
              </Button>
              <Select
                value={`${sortKey}:${sortDir}`}
                onValueChange={(v) => {
                  const [k, d] = v.split(":") as [SortKey, "asc" | "desc"]
                  setSortKey(k); setSortDir(d)
                }}
              >
                <SelectTrigger className="h-9 md:h-8 w-[180px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent:desc">Recent notes (newest)</SelectItem>
                  <SelectItem value="recent:asc">Recent notes (oldest)</SelectItem>
                  <SelectItem value="alpha:asc">Name (A→Z)</SelectItem>
                  <SelectItem value="alpha:desc">Name (Z→A)</SelectItem>
                  <SelectItem value="notes:desc">Most notes</SelectItem>
                  <SelectItem value="notes:asc">Fewest notes</SelectItem>
                  <SelectItem value="avg:desc">Highest avg</SelectItem>
                  <SelectItem value="avg:asc">Lowest avg</SelectItem>
                </SelectContent>
              </Select>
              {sortDir === "asc" ? <SortAsc className="h-4 w-4 text-muted-foreground" /> : <SortDesc className="h-4 w-4 text-muted-foreground" />}
              <div className="ml-2 inline-flex rounded-md border p-1">
                <Button
                  size="sm"
                  variant={view === "grid" ? "secondary" : "ghost"}
                  className="gap-1 h-9 md:h-8 px-3"
                  onClick={() => setView("grid")}
                >
                  <LayoutGrid className="h-4 w-4" /> Cards
                </Button>
                <Button
                  size="sm"
                  variant={view === "table" ? "secondary" : "ghost"}
                  className="gap-1 h-9 md:h-8 px-3"
                  onClick={() => setView("table")}
                >
                  <Rows className="h-4 w-4" /> Table
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Separator />
      {/* Tab: TRASH */}
      {activeTab === "trash" ? (
        <Card className="rounded-2xl p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-medium flex items-center gap-2">
              <Trash className="h-4 w-4" /> Trash ({trash.length})
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={emptyTrash}>
                <Trash2 className="mr-1 h-4 w-4" /> Empty trash
              </Button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {trash.map((t) => {
              const snap = t.snapshot
              return (
                <div key={`${t.scout_id}-${t.player_id}`} className="flex items-center gap-3 rounded-xl border p-3">
                  <PlayerAvatar src={snap?.image_url ?? null} alt={snap?.full_name ?? "Player"} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{snap?.full_name ?? t.player_id}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {(snap?.main_position ?? "—")}
                      {snap?.current_club_name ? ` · ${snap.current_club_name}` : ""}
                      {snap?.current_club_country ? ` (${snap.current_club_country})` : ""}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Removed {new Date(t.removed_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    {snap?.transfermarkt_url && (
                      <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
                        <a href={snap.transfermarkt_url} target="_blank" rel="noreferrer">
                          TM <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => restoreFromTrash(t)}
                      disabled={!!restoringByPlayer[t.player_id]}
                    >
                      {restoringByPlayer[t.player_id]
                        ? (<><Loader2 className="mr-1 h-4 w-4 animate-spin" />Restoring…</>)
                        : (<><RotateCcw className="mr-1 h-4 w-4" />Restore</>)}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      ) : null}
      {/* Tab: PLAYERS */}
      {activeTab === "players" && (
        <>
          {/* TABLE VIEW */}
          {view === "table" && (
            <div
              className="w-full overflow-x-auto rounded-2xl border shadow-sm
                         [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <Table className="text-[13px] md:text-sm">
                <TableHeader>
                  <TableRow className="whitespace-nowrap">
                    <TableHead className="min-w-[240px] sm:min-w-[320px] sticky left-0  z-10">Player</TableHead>
                    <TableHead className="hidden sm:table-cell">Position</TableHead>
                    <TableHead className="hidden md:table-cell">Club</TableHead>
                    <TableHead className="hidden lg:table-cell">Country</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Notes</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Avg</TableHead>
                    <TableHead className="hidden xl:table-cell text-right">Voice</TableHead>
                    <TableHead className="hidden xl:table-cell text-right">Obs</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[260px]">Add to observation</TableHead>
                    <TableHead className="min-w-[180px] sm:min-w-[220px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Loader skeleton rows */}
                  {loadingPlayers && !filteredSorted.length && (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={`sk-${i}`} className="animate-pulse">
                        <TableCell className="sticky left-0  z-10">
                          <div className="flex items-center gap-3">
                            <div className="h-16 w-16 rounded-md bg-muted" />
                            <div className="min-w-0 flex-1">
                              <div className="h-4 w-40 rounded bg-muted mb-2" />
                              <div className="h-3 w-24 rounded bg-muted" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell"><div className="h-3 w-20 bg-muted rounded" /></TableCell>
                        <TableCell className="hidden md:table-cell"><div className="h-3 w-24 bg-muted rounded" /></TableCell>
                        <TableCell className="hidden lg:table-cell"><div className="h-3 w-16 bg-muted rounded" /></TableCell>
                        <TableCell className="hidden md:table-cell text-right"><div className="h-3 w-8 bg-muted rounded ml-auto" /></TableCell>
                        <TableCell className="hidden lg:table-cell text-right"><div className="h-3 w-8 bg-muted rounded ml-auto" /></TableCell>
                        <TableCell className="hidden xl:table-cell text-right"><div className="h-3 w-8 bg-muted rounded ml-auto" /></TableCell>
                        <TableCell className="hidden xl:table-cell text-right"><div className="h-3 w-8 bg-muted rounded ml-auto" /></TableCell>
                        <TableCell className="hidden md:table-cell"><div className="h-9 w-56 bg-muted rounded" /></TableCell>
                        <TableCell><div className="h-9 w-40 bg-muted rounded" /></TableCell>
                      </TableRow>
                    ))
                  )}
                  {!loadingPlayers && filteredSorted.map((p) => {
                    const existsInAny = !!existingByPlayer[p.id]?.size
                    const selectedSession = selectedByPlayer[p.id] || ""
                    const existsInSelected = !!(selectedSession && existingByPlayer[p.id]?.has(selectedSession))
                    const noteAgg = notesByPlayer[p.id]
                    const removing = !!removingByPlayer[p.id]
                    const adding = !!addingByPlayer[p.id]
                    return (
                      <TableRow key={p.id} className="align-top bg-background">
                        <TableCell className="sticky left-0  z-10">
                          <div className="flex items-start gap-3">
                            <div className="md:shrink-0">
                              <PlayerAvatar src={p.image_url} alt={p.full_name} />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium">{p.full_name}</div>
                              <div className="truncate text-[11px] text-muted-foreground">
                                {existsInAny ? `In ${existingByPlayer[p.id]!.size} observation${existingByPlayer[p.id]!.size>1?"s":""}` : "—"}
                              </div>
                              {/* Mobile-inline add to observation (since big column is hidden) */}
                              <div className="mt-2 grid gap-2 sm:hidden">
                                <Select
                                  value={selectedSession}
                                  onValueChange={(id) => setSelectedSession(p.id, id)}
                                  disabled={loadingSessions || adding}
                                >
                                  <SelectTrigger className="h-11 md:h-9 w-full">
                                    <SelectValue placeholder={loadingSessions ? "Loading…" : "Choose session…"} />
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
                                {existsInSelected && (
                                  <div className="inline-flex items-center gap-1 text-[12px] text-emerald-700">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Already in this observation
                                  </div>
                                )}
                                <Button
                                  size="sm"
                                  className="w-full h-11 md:h-9"
                                  onClick={() => addToObservation(p.id)}
                                  disabled={adding || existsInSelected || !selectedSession}
                                >
                                  {adding ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Adding…</> :
                                    existsInSelected ? "Already added" : <><PlusCircle className="mr-1 h-4 w-4" /> Add</>}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{p.main_position || "—"}</TableCell>
                        <TableCell className="hidden md:table-cell">{p.current_club_name || "—"}</TableCell>
                        <TableCell className="hidden lg:table-cell">{p.current_club_country || "—"}</TableCell>
                        <TableCell className="hidden md:table-cell text-right">{noteAgg?.count ?? 0}</TableCell>
                        <TableCell className="hidden lg:table-cell text-right">{noteAgg?.avg ?? "—"}</TableCell>
                        <TableCell className="hidden xl:table-cell text-right">{voicesByPlayer[p.id] || 0}</TableCell>
                        <TableCell className="hidden xl:table-cell text-right">{existingByPlayer[p.id]?.size ?? 0}</TableCell>
                        {/* Desktop add to observation */}
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <Select
                              value={selectedSession}
                              onValueChange={(id) => setSelectedSession(p.id, id)}
                              disabled={loadingSessions || adding}
                            >
                              <SelectTrigger className="h-9 w-[220px]">
                                <SelectValue placeholder={loadingSessions ? "Loading…" : "Choose session…"} />
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
                            <Button
                              size="sm"
                              onClick={() => addToObservation(p.id)}
                              disabled={adding || existsInSelected || !selectedSession}
                            >
                              {adding ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Adding…</> :
                              existsInSelected ? "Already in" : <><PlusCircle className="mr-1 h-4 w-4" />Add</>}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button asChild size="sm"><Link href={`/scout/players/${p.id}`}>Open</Link></Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeFromMyPlayers(p.id)}
                              disabled={removing}
                              title="Move to Trash"
                            >
                              {removing ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Removing…</> : <><Trash2 className="mr-1 h-4 w-4" />Trash</>}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {/* GRID VIEW (mobile-first) */}
          {view === "grid" && (
            <>
              {/* Mobile rail */}
              <div className="md:hidden">
                <div className="overflow-x-auto pb-3 -mx-2 px-2" role="region" aria-label="My Players horizontal list">
                  <div className="flex flex-wrap snap-x snap-mandatory gap-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {filteredSorted.map((p) => (
                      <PlayerCard
                        key={p.id}
                        p={p}
                        sessions={sessions}
                        loadingSessions={loadingSessions}
                        existingSessionIds={existingByPlayer[p.id]}
                        selectedSession={selectedByPlayer[p.id] || ""}
                        onSelectSession={(id) => setSelectedSession(p.id, id)}
                        onAddToObservation={() => addToObservation(p.id)}
                        adding={!!addingByPlayer[p.id]}
                        notesAgg={notesByPlayer[p.id]}
                        voicesCount={voicesByPlayer[p.id] || 0}
                        onRemove={() => removeFromMyPlayers(p.id)}
                        removing={!!removingByPlayer[p.id]}
                        className="min-w-[88vw] max-w-[88vw] snap-start"
                      />
                    ))}
                  </div>
                </div>
              </div>
              {/* Desktop grid */}
              <div className="hidden md:block">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredSorted.map((p) => (
                    <PlayerCard
                      key={p.id}
                      p={p}
                      sessions={sessions}
                      loadingSessions={loadingSessions}
                      existingSessionIds={existingByPlayer[p.id]}
                      selectedSession={selectedByPlayer[p.id] || ""}
                      onSelectSession={(id) => setSelectedSession(p.id, id)}
                      onAddToObservation={() => addToObservation(p.id)}
                      adding={!!addingByPlayer[p.id]}
                      notesAgg={notesByPlayer[p.id]}
                      voicesCount={voicesByPlayer[p.id] || 0}
                      onRemove={() => removeFromMyPlayers(p.id)}
                      removing={!!removingByPlayer[p.id]}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
      {/* Mobile bottom dock */}
<BottomDock
  onlyWithNotes={onlyWithNotes}
  setOnlyWithNotes={setOnlyWithNotes}
  view={view}
  setView={setView}
  onSearchFocus={() => {
    const el = document.getElementById(searchInputId) as HTMLInputElement | null
    el?.focus()
  }}
  cycleSort={() => {
    const order: Array<[SortKey, "asc" | "desc"]> = [
      ["recent", "desc"], ["alpha", "asc"], ["avg", "desc"]
    ]
    const idx = order.findIndex(([k,d]) => k === sortKey && d === sortDir)
    const next = order[(idx + 1) % order.length]
    setSortKey(next[0]); setSortDir(next[1])
  }}
  onOpenVisual={() => setVisualOpen(true)}      // <-- add this
/>
<VisualTreeModal
  open={visualOpen}
  onOpenChange={setVisualOpen}
  players={localItems}
  notesByPlayer={notesByPlayer}
  voicesByPlayer={voicesByPlayer}
  existingByPlayer={existingByPlayer}
/>
    </div>
  )
}
/* ---------------- Card ---------------- */
function PlayerCard({
  p, sessions, loadingSessions, existingSessionIds, selectedSession, onSelectSession, onAddToObservation,
  adding = false, notesAgg, voicesCount = 0, onRemove, removing = false, className = "",
}: {
  p: Row
  sessions: Session[]
  loadingSessions: boolean
  existingSessionIds?: Set<string>
  selectedSession: string
  onSelectSession: (id: string) => void
  onAddToObservation: () => void
  adding?: boolean
  notesAgg?: NoteAgg
  voicesCount?: number
  onRemove: () => void
  removing?: boolean
  className?: string
}) {
  const existsInAny = !!existingSessionIds && existingSessionIds.size > 0
  const existsInSelected = !!(selectedSession && existingSessionIds?.has(selectedSession))
  const notesCount = notesAgg?.count ?? 0
  const notesAvg = notesAgg?.avg
  const lastNotes = notesAgg?.last ?? []
  return (
    <Card className={`rounded-2xl border bg-card/50 transition hover:shadow-sm ${className}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <PlayerAvatar src={p.image_url} alt={p.full_name} />
            <div className="min-w-0">
              <div className="truncate font-semibold">{p.full_name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {p.main_position ? `Pos: ${p.main_position}` : "—"}
                {p.current_club_name ? ` · ${p.current_club_name}` : ""}
                {p.current_club_country ? ` (${p.current_club_country})` : ""}
              </div>
              {existsInAny && (
                <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  In {existingSessionIds!.size} observation{existingSessionIds!.size > 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>
          <Button
            variant="destructive"
            size="icon"
            className="h-10 w-10 md:h-8 md:w-8"
            onClick={onRemove}
            disabled={removing}
            title="Move to Trash"
          >
            {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1"><FileText className="h-3 w-3" />{notesCount} note{notesCount === 1 ? "" : "s"}</Badge>
          <Badge variant="outline">Avg {notesAvg ?? "—"}/10</Badge>
          <Badge variant="outline" className="gap-1"><Mic className="h-3 w-3" /> {voicesCount}</Badge>
        </div>
        {lastNotes.length > 0 && (
          <div className="mt-3 grid gap-2">
            {lastNotes.map((n, i) => (
              <div key={i} className="rounded-md border  px-2 py-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{CATEGORY_LABELS[n.category] || n.category}</span>
                  <span className="text-muted-foreground">{n.rating ?? "—"}/10</span>
                </div>
                {n.comment && <div className="mt-1 line-clamp-2 text-xs">{n.comment}</div>}
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-col gap-2">
          <Select value={selectedSession} onValueChange={onSelectSession} disabled={loadingSessions || adding}>
            <SelectTrigger className="h-11 md:h-9 w-full">
              <SelectValue placeholder={loadingSessions ? "Loading sessions…" : "Choose observation session…"} />
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
          {existsInSelected && (
            <div className="inline-flex items-center gap-1 text-[12px] text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Already in this observation
            </div>
          )}
          <Button
            onClick={onAddToObservation}
            disabled={adding || existsInSelected || !selectedSession}
            className="w-full h-11 md:h-9"
          >
            {adding ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Adding…</> :
             existsInSelected ? "Already added" : <><PlusCircle className="mr-1 h-4 w-4" /> Add to observation</>}
          </Button>
        </div>
      </div>
    </Card>
  )
}
function PlayerAvatar({ src, alt }: { src: string | null; alt: string }) {
  const base = "rounded-md border object-cover shrink-0"
  if (!src) {
    return (
      <div className={`grid place-items-center bg-muted text-[10px] text-muted-foreground
                       h-14 w-14 md:h-16 md:w-16 ${base}`}>
        No photo
      </div>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      className={`h-14 w-14 md:h-16 md:w-16 ${base}`}
      loading="lazy"
      decoding="async"
    />
  )
}
/* ---------------- Mobile Bottom Dock ---------------- */
function BottomDock({
  onlyWithNotes, setOnlyWithNotes,
  view, setView,
  onSearchFocus,
  cycleSort,
  onOpenVisual,              // <-- add
}: {
  onlyWithNotes: boolean
  setOnlyWithNotes: (v: boolean | ((prev: boolean) => boolean)) => void
  view: ViewMode
  setView: (v: ViewMode) => void
  onSearchFocus: () => void
  cycleSort: () => void
  onOpenVisual: () => void   // <-- add
}) {
  return (
<nav className="fixed inset-x-2 bottom-2 z-40 md:hidden">
  <div className="rounded-2xl border bg-background/90 backdrop-blur px-2 py-1 shadow-lg">
    <div className="grid grid-cols-5 gap-1">  {/* was 4 */}
      <Button variant="ghost" size="sm" className="h-9" onClick={onSearchFocus}>
        <Search className="mr-1 h-4 w-4" /> Search
      </Button>
      <Button variant={onlyWithNotes ? "secondary" : "ghost"} size="sm" className="h-9"
              onClick={() => setOnlyWithNotes(v => !v)}>
        <Filter className="mr-1 h-4 w-4" /> Notes
      </Button>
      <Button variant="ghost" size="sm" className="h-9" onClick={cycleSort}>
        <ListFilter className="mr-1 h-4 w-4" /> Sort
      </Button>
      <Button
        type="button"
        size="sm"
        className="h-9"
        onClick={onOpenVisual}                 // <-- use the prop
      >
        <GitBranch className="mr-1 h-4 w-4" />
        Visual
      </Button>
      <Button variant="ghost" size="sm" className="h-9"
              onClick={() => setView(view === "grid" ? "table" : "grid")}>
        {view === "grid" ? <Rows className="mr-1 h-4 w-4" /> : <LayoutGrid className="mr-1 h-4 w-4" />}
        View
      </Button>
    </div>
  </div>
</nav>
  )
}
