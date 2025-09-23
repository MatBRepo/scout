// app/admin/scraper/data/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/browser"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  ChevronDown, ChevronRight, Users2,
  Trash2, X, Check, AlertTriangle, RefreshCw, Copy, Link as LinkIcon, Filter
} from "lucide-react"
import { toast } from "sonner"

/* ------------- Types ------------- */
type ClubRow = {
  competition_code: string
  season_id: number
  tm_club_id: number
  name: string
  profile_path?: string | null
  squad_size?: number | null
  avg_age?: number | null
  foreigners?: number | null
  total_market_value_eur?: number | null
}

type PlayerRow = {
  season_id: number
  tm_club_id: number
  tm_player_id: number
  name: string
  position: string | null
  nationalities: string[] | null
  contract_until: string | null
  market_value_eur: number | null
  player_path: string | null
  image_url: string | null
  age: number | null
  number: string | null
}

type PlayerCount = Record<string, number> // key: `${season_id}:${tm_club_id}`

type PendingPlayer = { season_id: number; tm_club_id: number; tm_player_id: number; name?: string }
type PendingClub = { season_id: number; tm_club_id: number; name?: string }

/* ------------- Page ------------- */
export default function ScrapedDataPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [clubs, setClubs] = useState<ClubRow[]>([])
  const [playerCounts, setPlayerCounts] = useState<PlayerCount>({})
  const [search, setSearch] = useState("")
  const [compNames, setCompNames] = useState<Record<string, string>>({})
  const [onlyWithPlayers, setOnlyWithPlayers] = useState(false)

  // expanded club keys + cached players
  const [openClubs, setOpenClubs] = useState<Set<string>>(new Set())
  const [playersCache, setPlayersCache] = useState<Record<string, PlayerRow[] | "loading" | "error">>({})

  // deletion staging
  const [pendingPlayers, setPendingPlayers] = useState<Record<string, PendingPlayer>>({})
  const [pendingClubs, setPendingClubs] = useState<Record<string, PendingClub>>({})


  

  /* ------------ Load data ------------ */
  const reload = async () => {
    setLoading(true)
    try {
      // Clubs: load * to be tolerant to optional columns
      const { data: clubData, error: clubErr } = await supabase
        .from("tm_clubs")
        .select("*")
        .order("season_id", { ascending: false })
        .order("name", { ascending: true })
        .limit(400)

      if (clubErr) throw clubErr
      const list = (clubData ?? []) as any[]

      const mapped: ClubRow[] = list.map((r) => ({
        competition_code: r.competition_code,
        season_id: r.season_id,
        tm_club_id: r.tm_club_id,
        name: r.name,
        profile_path: r.profile_path ?? null,
        squad_size: r.squad_size ?? null,
        avg_age: r.avg_age ?? null,
        foreigners: r.foreigners ?? null,
        total_market_value_eur: r.total_market_value_eur ?? null,
      }))
      setClubs(mapped)

      // player counts for the visible clubs
      if (mapped.length) {
        const seasonIds = Array.from(new Set(mapped.map((c) => c.season_id)))
        const clubIds = Array.from(new Set(mapped.map((c) => c.tm_club_id)))

        const { data: playersData, error: playersErr } = await supabase
          .from("tm_squad_players")
          .select("season_id, tm_club_id")
          .in("season_id", seasonIds)
          .in("tm_club_id", clubIds)
          .limit(10000)

        if (playersErr) throw playersErr

        const counts: PlayerCount = {}
        for (const p of playersData ?? []) {
          const k = `${p.season_id}:${p.tm_club_id}`
          counts[k] = (counts[k] || 0) + 1
        }
        setPlayerCounts(counts)
      } else {
        setPlayerCounts({})
      }

      // competition names (optional)
      const codes = Array.from(new Set(mapped.map((c) => c.competition_code))).filter(Boolean)
      if (codes.length) {
        const { data: comps } = await supabase
          .from("tm_competitions")
          .select("code, name")
          .in("code", codes)

        if (Array.isArray(comps)) {
          const m: Record<string, string> = {}
          for (const row of comps) m[row.code] = row.name
          setCompNames(m)
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load scraped data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ------------ Helpers ------------ */
  const formatEuro = (v?: number | null) => {
    if (!v || v <= 0) return "—"
    if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)}m`
    if (v >= 1_000) return `€${(v / 1_000).toFixed(0)}k`
    return `€${v}`
  }

  const keyClub = (c: ClubRow) => `${c.season_id}:${c.tm_club_id}`
  const keyPlayer = (p: PlayerRow) => `${p.season_id}:${p.tm_club_id}:${p.tm_player_id}`

  const filteredClubs = useMemo(() => {
    const q = search.trim().toLowerCase()
    let base = clubs
    if (onlyWithPlayers) {
      base = base.filter(c => (playerCounts[keyClub(c)] ?? 0) > 0)
    }
    if (!q) return base
    return base.filter((c) => {
      const compName = compNames[c.competition_code] || c.competition_code
      return (
        c.name.toLowerCase().includes(q) ||
        c.competition_code.toLowerCase().includes(q) ||
        compName.toLowerCase().includes(q) ||
        (c.profile_path || "").toLowerCase().includes(q)
      )
    })
  }, [clubs, search, compNames, onlyWithPlayers, playerCounts])

  const groups = useMemo(() => {
    const map: Record<string, { compCode: string; season: number; items: ClubRow[] }> = {}
    for (const c of filteredClubs) {
      const key = `${c.competition_code}:${c.season_id}`
      if (!map[key]) map[key] = { compCode: c.competition_code, season: c.season_id, items: [] }
      map[key].items.push(c)
    }
    return Object.values(map).sort((a, b) => {
      const an = (compNames[a.compCode] || a.compCode).localeCompare(compNames[b.compCode] || b.compCode)
      if (an !== 0) return an
      return b.season - a.season
    })
  }, [filteredClubs, compNames])

  const toggleClubOpen = async (club: ClubRow) => {
    const key = keyClub(club)
    const isOpen = openClubs.has(key)

    if (isOpen) {
      const next = new Set(openClubs)
      next.delete(key)
      setOpenClubs(next)
      return
    }

    // fetch players if not cached
    if (!playersCache[key]) {
      setPlayersCache((s) => ({ ...s, [key]: "loading" }))
      const { data, error } = await supabase
        .from("tm_squad_players")
        .select(
          "season_id, tm_club_id, tm_player_id, name, position, nationalities:nationality, contract_until:contract_end, market_value_eur, player_path:profile_path, image_url:photo_url, dob, number"
        )
        .eq("season_id", club.season_id)
        .eq("tm_club_id", club.tm_club_id)
        .order("name", { ascending: true })

      if (error) {
        setPlayersCache((s) => ({ ...s, [key]: "error" }))
        toast.error(`Failed to load players for ${club.name}`)
      } else {
        const mapped: PlayerRow[] = (data ?? []).map((r: any) => ({
          season_id: r.season_id,
          tm_club_id: r.tm_club_id,
          tm_player_id: r.tm_player_id,
          name: r.name,
          position: r.position ?? null,
          nationalities: r.nationalities ?? null,
          contract_until: r.contract_until ?? null,
          market_value_eur: r.market_value_eur ?? null,
          player_path: r.player_path ?? null,
          image_url: r.image_url ?? null,
          age: computeAge(r.dob) ?? null,
          number: r.number ?? null,
        }))
        setPlayersCache((s) => ({ ...s, [key]: mapped }))
      }
    }

    const next = new Set(openClubs)
    next.add(key)
    setOpenClubs(next)
  }

  /* ------------ Mark for deletion ------------ */
  const togglePendingClub = (c: ClubRow) => {
    const k = keyClub(c)
    setPendingClubs((s) => {
      const next = { ...s }
      if (next[k]) delete next[k]
      else next[k] = { season_id: c.season_id, tm_club_id: c.tm_club_id, name: c.name }
      return next
    })
  }

  const togglePendingPlayer = (p: PlayerRow) => {
    const k = keyPlayer(p)
    setPendingPlayers((s) => {
      const next = { ...s }
      if (next[k]) delete next[k]
      else next[k] = { season_id: p.season_id, tm_club_id: p.tm_club_id, tm_player_id: p.tm_player_id, name: p.name }
      return next
    })
  }

  const pendingCounts = {
    clubs: Object.keys(pendingClubs).length,
    players: Object.keys(pendingPlayers).length,
  }
  const totalPending = pendingCounts.clubs + pendingCounts.players

  const clearPending = () => {
    setPendingClubs({})
    setPendingPlayers({})
  }

  /* ------------ Approve (perform deletes) ------------ */
  const approveDeletes = async () => {
    if (!totalPending) return

    let clubsDeleted = 0
    let playersDeleted = 0
    try {
      // 1) Delete whole-club data
      for (const k of Object.keys(pendingClubs)) {
        const c = pendingClubs[k]

        const delPlayers = await supabase
          .from("tm_squad_players")
          .delete()
          .match({ season_id: c.season_id, tm_club_id: c.tm_club_id })
        if (delPlayers.error) throw delPlayers.error
        playersDeleted += delPlayers.count ?? 0

        const delClub = await supabase
          .from("tm_clubs")
          .delete()
          .match({ season_id: c.season_id, tm_club_id: c.tm_club_id })
        if (delClub.error) throw delClub.error
        clubsDeleted += delClub.count ?? 1

        // local UI update
        setClubs((list) => list.filter((cl) => !(cl.season_id === c.season_id && cl.tm_club_id === c.tm_club_id)))
        setPlayerCounts((pc) => {
          const next = { ...pc }
          delete next[`${c.season_id}:${c.tm_club_id}`]
          return next
        })
        setPlayersCache((cache) => {
          const next = { ...cache }
          delete next[`${c.season_id}:${c.tm_club_id}`]
          return next
        })
      }

      // 2) Delete single players where club isn’t already pending
      const remainingPlayers = Object.values(pendingPlayers).filter(
        (p) => !pendingClubs[`${p.season_id}:${p.tm_club_id}`]
      )
      const grouped: Record<string, PendingPlayer[]> = {}
      for (const p of remainingPlayers) {
        const k = `${p.season_id}:${p.tm_club_id}`
        ;(grouped[k] ||= []).push(p)
      }

      for (const k of Object.keys(grouped)) {
        const [season_id, tm_club_id] = k.split(":").map((n) => Number(n))
        const ids = grouped[k].map((p) => p.tm_player_id)
        const del = await supabase
          .from("tm_squad_players")
          .delete()
          .eq("season_id", season_id)
          .eq("tm_club_id", tm_club_id)
          .in("tm_player_id", ids)
        if (del.error) throw del.error
        playersDeleted += del.count ?? ids.length

        // local UI update for open cache + count
        setPlayersCache((cache) => {
          const next = { ...cache }
          const ck = `${season_id}:${tm_club_id}`
          const arr = Array.isArray(next[ck]) ? (next[ck] as PlayerRow[]) : null
          if (arr) next[ck] = arr.filter((p) => !ids.includes(p.tm_player_id))
          return next
        })
        setPlayerCounts((pc) => {
          const next = { ...pc }
          const kk = `${season_id}:${tm_club_id}`
          next[kk] = Math.max(0, (next[kk] ?? 0) - ids.length)
          return next
        })
      }

      toast.success(
        `Deleted ${playersDeleted} player${playersDeleted === 1 ? "" : "s"}${clubsDeleted ? ` and ${clubsDeleted} club${clubsDeleted === 1 ? "" : "s"}` : ""}.`
      )
      clearPending()
    } catch (e: any) {
      toast.error(e?.message || "Delete failed")
    }
  }

  /* ------------ Danger: Delete ALL ------------ */
const deleteAll = async () => {
  if (!confirm("Delete ALL scraped data (clubs + players)? This cannot be undone.")) return
  try {
    const { data, error } = await supabase.rpc("admin_wipe_tm_data")
    if (error) throw error

    // optional: use returned counts
    const counts = Array.isArray(data) && data[0] ? data[0] : { players_deleted: 0, clubs_deleted: 0 }
    toast.success(`Removed ${counts.players_deleted} players and ${counts.clubs_deleted} clubs.`)

    // Clear local state OR simply reload from DB
    setClubs([])
    setPlayersCache({})
    setPlayerCounts({})
    clearPending()
    // or await reload()
  } catch (e: any) {
    toast.error(e?.message || "Failed to delete all")
  }
}

  /* ------------ Toolbar helpers ------------ */
  const expandAll = () => {
    const all = new Set<string>()
    for (const c of filteredClubs) all.add(keyClub(c))
    setOpenClubs(all)
  }
  const collapseAll = () => setOpenClubs(new Set())

  const copyToClipboard = async (text?: string | null) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copied")
    } catch {
      toast.error("Copy failed")
    }
  }

  const totalClubs = clubs.length
  const totalPlayersVisible = filteredClubs.reduce((acc, c) => acc + (playerCounts[keyClub(c)] ?? 0), 0)

  /* ------------ UI ------------ */
  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Scraped data</h1>
          <span className="hidden sm:inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
            Clubs: {totalClubs}
          </span>
          <span className="hidden sm:inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
            Players (visible clubs): {totalPlayersVisible}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Input
              placeholder="Search competition / club / path…"
              className="pr-8 w-[240px] sm:w-[300px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Filter className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>

          <Button variant="outline" onClick={() => setOnlyWithPlayers(v => !v)}>
            {onlyWithPlayers ? "Show all clubs" : "Only with players"}
          </Button>

          <Button variant="outline" onClick={reload} className="gap-1">
            <RefreshCw className="h-4 w-4" /> Reload
          </Button>

          {/* Header Delete ALL (explicit) */}
          <Button
            variant="destructive"
            onClick={deleteAll}
            className="gap-1"
            title="Delete ALL scraped data (clubs + players)"
          >
            <Trash2 className="h-4 w-4" /> Delete ALL
          </Button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : groups.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">
          No data yet.
          <div className="mt-1">
            If you recently ran the scraper and see nothing, verify your DB insertions and RLS policies (read &amp; delete).
          </div>
        </Card>
      ) : (
        <>
          {/* Group-level controls */}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={expandAll}>Expand all</Button>
            <Button variant="outline" onClick={collapseAll}>Collapse all</Button>
            {!!Object.keys(pendingClubs).length && (
              <span className="text-xs text-muted-foreground">
                Marked clubs: {Object.keys(pendingClubs).length}
              </span>
            )}
            {!!Object.keys(pendingPlayers).length && (
              <span className="text-xs text-muted-foreground">
                Marked players: {Object.keys(pendingPlayers).length}
              </span>
            )}
          </div>

          <div className="space-y-4">
            {groups.map((g) => {
              const compLabel = compNames[g.compCode] || g.compCode
              return (
                <Card key={`${g.compCode}:${g.season}`} className="p-3 sm:p-4">
                  {/* Group header */}
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm sm:text-base font-semibold leading-tight">{compLabel}</div>
                      <div className="text-[11px] sm:text-xs text-muted-foreground">
                        Season {g.season} · {g.items.length} clubs
                      </div>
                    </div>
                  </div>

                  {/* Clubs list */}
                  <div className="divide-y">
                    {g.items
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((c) => {
                        const ck = keyClub(c)
                        const pc = playerCounts[ck] ?? 0
                        const isOpen = openClubs.has(ck)
                        const cache = playersCache[ck]
                        const marked = Boolean(pendingClubs[ck])

                        const tmUrl = c.profile_path
                          ? new URL(c.profile_path, "https://www.transfermarkt.com").toString()
                          : null

                        return (
                          <div key={ck} className={cn(marked && "bg-destructive/5")}>
                            <div className="flex items-center gap-3 py-2 px-2">
                              <button
                                onClick={() => toggleClubOpen(c)}
                                className="shrink-0 grid place-items-center rounded-md border w-6 h-6 hover:bg-muted"
                                aria-expanded={isOpen}
                                title={isOpen ? "Collapse" : "Expand"}
                              >
                                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="font-medium leading-tight truncate">{c.name}</div>
                                <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span>Squad: {c.squad_size ?? "—"}</span>
                                  <span>· Scraped: {pc}</span>
                                  {typeof c.avg_age === "number" && <span>· ø age: {c.avg_age}</span>}
                                  {typeof c.foreigners === "number" && <span>· foreign: {c.foreigners}</span>}
                                  {c.profile_path && (
                                    <>
                                      <button
                                        className="inline-flex items-center gap-1 rounded border px-1 py-0.5"
                                        onClick={() => copyToClipboard(c.profile_path!)}
                                        title="Copy TM path"
                                      >
                                        <Copy className="h-3 w-3" /> path
                                      </button>
                                      <a
                                        className="inline-flex items-center gap-1 rounded border px-1 py-0.5 hover:bg-muted"
                                        href={tmUrl || "#"}
                                        target="_blank"
                                        rel="noreferrer"
                                        title="Open on Transfermarkt"
                                      >
                                        <LinkIcon className="h-3 w-3" /> open
                                      </a>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="hidden sm:block text-right text-[11px]">
                                <div className="text-muted-foreground">Total MV</div>
                                <div className="font-medium">{formatEuro(c.total_market_value_eur)}</div>
                              </div>

                              <Button
                                size="icon"
                                variant={marked ? "destructive" : "outline"}
                                onClick={() => togglePendingClub(c)}
                                title={marked ? "Unmark club" : "Mark club (and all its players) for deletion"}
                                className="shrink-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Players */}
                            {isOpen && (
                              <div className="px-2 pb-2">
                                {cache === "loading" ? (
                                  <div className="text-xs text-muted-foreground px-2 py-2">Loading players…</div>
                                ) : cache === "error" ? (
                                  <div className="text-xs text-red-600 px-2 py-2">Failed to load players.</div>
                                ) : (Array.isArray(cache) && cache.length > 0) ? (
                                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {cache.map((p) => {
                                      const pk = keyPlayer(p)
                                      const pMarked =
                                        Boolean(pendingPlayers[pk]) || Boolean(pendingClubs[`${p.season_id}:${p.tm_club_id}`])
                                      const playerUrl = p.player_path
                                        ? new URL(p.player_path, "https://www.transfermarkt.com").toString()
                                        : null

                                      return (
                                        <div
                                          key={pk}
                                          className={cn(
                                            "flex items-center gap-3 rounded-md border p-2 bg-background",
                                            pMarked && "ring-1 ring-destructive/40 bg-destructive/5"
                                          )}
                                        >
                                          {/* Avatar */}
                                          <div className="shrink-0">
                                            {p.image_url ? (
                                              <img
                                                src={p.image_url}
                                                alt={p.name}
                                                className="h-12 w-12 rounded-md object-cover border"
                                              />
                                            ) : (
                                              <div className="h-12 w-12 rounded-md border grid place-items-center text-muted-foreground">
                                                <Users2 className="h-5 w-5" />
                                              </div>
                                            )}
                                          </div>

                                          {/* Main info */}
                                          <div className="min-w-0">
                                            <div className="font-medium leading-tight truncate">{p.name}</div>
                                            <div className="text-[11px] text-muted-foreground truncate">
                                              {p.position || "—"}
                                              {typeof p.age === "number" ? ` · ${p.age}y` : ""}
                                              {p.nationalities?.length ? ` · ${p.nationalities.join(", ")}` : ""}
                                            </div>
                                            <div className="mt-0.5 text-[11px] truncate">
                                              <span className="text-muted-foreground">Contract:</span>{" "}
                                              {p.contract_until || "—"}{" "}
                                              <span className="text-muted-foreground">· MV:</span>{" "}
                                              {formatEuro(p.market_value_eur)}
                                            </div>
                                            <div className="mt-0.5 flex gap-2 text-[11px]">
                                              {p.player_path && (
                                                <>
                                                  <button
                                                    className="inline-flex items-center gap-1 rounded border px-1 py-0.5"
                                                    onClick={() => copyToClipboard(p.player_path!)}
                                                    title="Copy TM path"
                                                  >
                                                    <Copy className="h-3 w-3" /> path
                                                  </button>
                                                  <a
                                                    className="inline-flex items-center gap-1 rounded border px-1 py-0.5 hover:bg-muted"
                                                    href={playerUrl || "#"}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title="Open on Transfermarkt"
                                                  >
                                                    <LinkIcon className="h-3 w-3" /> open
                                                  </a>
                                                </>
                                              )}
                                            </div>
                                          </div>

                                          {/* Number + delete */}
                                          <div className="ml-auto flex items-center gap-2">
                                            <div className="text-right text-[11px] text-muted-foreground">#{p.number ?? "—"}</div>
                                            <Button
                                              size="icon"
                                              variant={pMarked ? "destructive" : "outline"}
                                              onClick={() => togglePendingPlayer(p)}
                                              title={pMarked ? "Unmark" : "Mark for deletion"}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-xs text-muted-foreground px-2 py-2">No players scraped yet.</div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {/* Sticky bottom approval bar */}
      <div className={cn("fixed inset-x-0 bottom-0 z-40 pointer-events-none")}>
        <div
          className={cn(
            "mx-auto max-w-6xl px-2 sm:px-4 pb-2 transition-all",
            totalPending ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          )}
        >
          <Card
            className={cn(
              "pointer-events-auto border-foreground/10 shadow-lg",
              "px-3 sm:px-4 py-2 sm:py-3 rounded-2xl"
            )}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="font-medium">Pending deletions:</span>
                <span className="text-muted-foreground">
                  {pendingCounts.players} player{pendingCounts.players === 1 ? "" : "s"}
                  {pendingCounts.clubs
                    ? ` · ${pendingCounts.clubs} club${pendingCounts.clubs === 1 ? "" : "s"}`
                    : ""}
                </span>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" className="gap-1" onClick={clearPending}>
                  <X className="h-4 w-4" /> Clear
                </Button>
                <Button variant="destructive" className="gap-1" onClick={approveDeletes}>
                  <Check className="h-4 w-4" /> Approve
                </Button>
                <Button
                  variant="destructive"
                  className="gap-1"
                  onClick={deleteAll}
                  title="Delete ALL scraped data (clubs + players)"
                >
                  <Trash2 className="h-4 w-4" /> Delete ALL
                </Button>
              </div>

              {totalPending > 0 && (
                <div className="basis-full mt-2">
                  <Progress value={Math.min(100, 10)} className="h-1" />
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ---------- utils ---------- */
function computeAge(dob?: string | null): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (isNaN(d.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--
  return age >= 0 ? age : null
}
