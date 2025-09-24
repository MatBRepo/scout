"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Search, Users, Globe, ExternalLink, Plus, Check, Filter,
  RotateCw, RefreshCw, X, ArrowLeftRight, LayoutGrid, Table as TableIcon
} from "lucide-react"

type Player = {
  id: string
  full_name: string
  main_position: string | null
  current_club_name: string | null
  current_club_country: string | null
  image_url: string | null
  transfermarkt_url: string | null
}

type SortKey = "newest" | "name" | "interest"
type SyncMode = "players" | "clubs" | "competitions"
type ViewMode = "cards" | "table"

/* ---------------- Football celebration overlay ---------------- */

function SoccerBallSVG(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" {...props}>
      <defs>
        <clipPath id="circle">
          <circle cx="32" cy="32" r="30" />
        </clipPath>
      </defs>
      <g clipPath="url(#circle)">
        <rect width="64" height="64" fill="#fff" />
        <path d="M32 22 l9 6 -3 10 h-12 l-3 -10 z" fill="#111" />
        <path d="M18 20 l7 2 -2 6 -7 -2 z" fill="#111" />
        <path d="M45 20 l7 2 -4 5 -6 -2 z" fill="#111" />
        <path d="M14 34 l6 -2 3 6 -6 3 z" fill="#111" />
        <path d="M50 34 l-6 -2 -3 6 6 3 z" fill="#111" />
        <path d="M26 46 l12 0 2 6 -16 0 z" fill="#111" />
      </g>
      <circle cx="32" cy="32" r="30" fill="none" stroke="#111" strokeWidth="2" />
    </svg>
  )
}

function FootballCelebration({
  show,
  duration = 2600,
  count = 10,
}: { show: boolean; duration?: number; count?: number }) {
  const balls = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 86 + 7,
        delay: Math.random() * 250,
        scale: 0.8 + Math.random() * 0.6,
        height: 90 + Math.random() * 70,
        drift: (Math.random() - 0.5) * 40,
        duration: 850 + Math.random() * 450,
      })),
    [count]
  )

  if (!show) return null

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 h-40 md:h-44">
        {balls.map(b => (
          <span
            key={b.id}
            className="absolute block will-change-transform"
            style={{ left: `${b.left}%`, animationDelay: `${b.delay}ms` }}
          >
            <span
              className="block absolute bottom-0 left-1/2 -translate-x-1/2 h-2 w-10 md:w-12 rounded-full bg-black/15 blur-[2px] animate-football-shadow"
              style={{ animationDuration: `${b.duration}ms` }}
            />
            <SoccerBallSVG
              className="h-10 w-10 md:h-12 md:w-12 drop-shadow-sm animate-football-bounce"
              style={
                {
                  ["--h" as any]: `${b.height}px`,
                  ["--dx" as any]: `${b.drift}px`,
                  ["--ball-scale" as any]: b.scale,
                  animationDuration: `${b.duration}ms`,
                } as React.CSSProperties
              }
            />
          </span>
        ))}
      </div>

      <style jsx>{`
        @keyframes football-bounce-keyframes {
          0%   { transform: translate(0, 0) scale(var(--ball-scale, 1)); opacity: 0; }
          6%   { opacity: 1; }
          20%  { transform: translate(calc(var(--dx) * 0.25), calc(-1 * var(--h))) scale(calc(var(--ball-scale) * 1.02)); }
          32%  { transform: translate(calc(var(--dx) * 0.35), 0) scale(calc(var(--ball-scale) * 1.06), calc(var(--ball-scale) * 0.92)); }
          48%  { transform: translate(calc(var(--dx) * 0.60), calc(-0.55 * var(--h))) scale(calc(var(--ball-scale) * 1.01)); }
          58%  { transform: translate(calc(var(--dx) * 0.70), 0) scale(calc(var(--ball-scale) * 1.05), calc(var(--ball-scale) * 0.94)); }
          72%  { transform: translate(calc(var(--dx) * 0.90), calc(-0.28 * var(--h))) scale(var(--ball-scale)); }
          80%  { transform: translate(calc(var(--dx) * 1.00), 0) scale(calc(var(--ball-scale) * 1.03), calc(var(--ball-scale) * 0.96)); }
          92%  { transform: translate(calc(var(--dx) * 1.05), calc(-0.08 * var(--h))) scale(var(--ball-scale)); }
          100% { transform: translate(calc(var(--dx) * 1.10), 0) scale(var(--ball-scale)); opacity: 0; }
        }
        .animate-football-bounce {
          animation-name: football-bounce-keyframes;
          animation-timing-function: cubic-bezier(.25,.7,.3,1);
          animation-iteration-count: 1;
        }
        @keyframes football-shadow-keyframes {
          0%   { transform: scaleX(0.7); opacity: 0; }
          8%   { opacity: 1; }
          20%  { transform: scaleX(0.5); }
          32%  { transform: scaleX(0.85); }
          48%  { transform: scaleX(0.6); }
          58%  { transform: scaleX(0.85); }
          72%  { transform: scaleX(0.7); }
          80%  { transform: scaleX(0.9); }
          92%  { transform: scaleX(0.75); }
          100% { transform: scaleX(0.8); opacity: 0; }
        }
        .animate-football-shadow {
          animation-name: football-shadow-keyframes;
          animation-timing-function: ease-out;
          animation-iteration-count: 1;
        }
        @keyframes glow-pulse-once {
          0%   { box-shadow: 0 0 0 0 rgba(59,130,246,.35); }
          40%  { box-shadow: 0 0 0 10px rgba(59,130,246,.0); }
          80%  { box-shadow: 0 0 0 10px rgba(59,130,246,.0); }
          100% { box-shadow: 0 0 0 0 rgba(59,130,246,.0); }
        }
        .animate-glow-once {
          animation: glow-pulse-once 1.6s ease-out 1;
        }
      `}</style>
    </>
  )
}

/* ---------------- Page ---------------- */

export default function DiscoverPlayersPage() {
  const t = useTranslations()

  // filters/state
  const [search, setSearch] = useState("")
  const [position, setPosition] = useState<string>("any")
  const [country, setCountry] = useState<string>("")
  const [sort, setSort] = useState<SortKey>("newest")
  const [view, setView] = useState<ViewMode>("cards")

  // data
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Player[]>([])
  const [following, setFollowing] = useState<Record<string, boolean>>({})
  const [interest, setInterest] = useState<Record<string, number>>({})
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  // sync state
  const [syncMode, setSyncMode] = useState<SyncMode>("players")
  const [syncing, setSyncing] = useState(false)
  const [bulkSyncing, setBulkSyncing] = useState(false)

  // compare state
  const MAX_COMPARE = 5
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareLoading, setCompareLoading] = useState(false)
  const [details, setDetails] = useState<Record<string, any>>({})

  // celebration
  const [celebrate, setCelebrate] = useState(false)

  const hasItems = items.length > 0
  const abortRef = useRef<AbortController | null>(null)

  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    if (search) p.set("search", search)
    if (position !== "any") p.set("position", position)
    if (country) p.set("country", country)
    p.set("sort", sort)
    p.set("page", String(page))
    p.set("limit", "24")
    return p.toString()
  }, [search, position, country, sort, page])

  // fetcher
  const fetchPage = async (reset = false) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/scout/discover?${queryString}`, {
        cache: "no-store",
        signal: controller.signal,
      })
      if (!res.ok) {
        let msg = res.statusText || `HTTP ${res.status}`
        try { const j = await res.json(); msg = (j as any)?.error || msg } catch {}
        throw new Error(msg)
      }
      const data = await res.json()
      setFollowing(prev => (reset ? data.following : { ...prev, ...data.following }))
      setInterest(prev => (reset ? data.interest  : { ...prev, ...data.interest }))
      setItems(prev => (reset ? data.players : [...prev, ...(data.players ?? [])]))
    } catch (e: any) {
      if (e?.name === "AbortError") return
      const msg = e?.message || t("discover.errors.loadFailed")
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // initial + on filter change (debounced) -> reset list
  useEffect(() => {
    const tmo = setTimeout(() => {
      setPage(1)
      fetchPage(true)
    }, 250)
    return () => clearTimeout(tmo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, position, country, sort])

  // pagination
  const loadMore = () => setPage(p => p + 1)
  useEffect(() => {
    if (page > 1) fetchPage(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // client-side "interest" sort
  const visible = useMemo(() => {
    if (sort !== "interest") return items
    return [...items].sort((a, b) => (interest[b.id] ?? 0) - (interest[a.id] ?? 0))
  }, [items, sort, interest])

  // --- Sync from Transfermarkt (uses current search) ---
  const syncFromTransfermarkt = async () => {
    const name = search.trim()
    if (!name) {
      toast.message(
        t("discover.sync.needName.title"),
        { description: t("discover.sync.needName.desc") }
      )
      return
    }
    setSyncing(true)
    try {
      const r = await fetch("/api/admin/transfermarkt/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: name, mode: syncMode }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || t("discover.sync.failed"))

      toast.success(t("discover.sync.result", {
        imported: j.imported ?? 0,
        matched: j.matched ?? 0
      }))
      setPage(1)
      await fetchPage(true)
    } catch (e: any) {
      toast.error(e?.message || t("discover.sync.failed"))
    } finally {
      setSyncing(false)
    }
  }

  const syncMissing = async () => {
    setBulkSyncing(true)
    try {
      const res = await fetch(
        `/api/admin/transfermarkt/import?mode=players&strict=1&q=${encodeURIComponent(search.trim())}`,
        { method: "POST" }
      )
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || t("discover.sync.bulkFailed"))

      toast.success(t("discover.sync.bulkResult", {
        scanned: body.scanned ?? 0,
        matched: body.matched ?? 0,
        notFound: body.notFound ?? 0
      }))
      await fetchPage(true)
    } catch (e: any) {
      toast.error(e?.message || t("discover.sync.bulkFailed"))
    } finally {
      setBulkSyncing(false)
    }
  }

  // ---- Follow / Unfollow ----
  const celebrateTimer = useRef<number | null>(null)
  const triggerCelebration = () => {
    if (celebrateTimer.current) {
      window.clearTimeout(celebrateTimer.current)
      celebrateTimer.current = null
    }
    setCelebrate(true)
    celebrateTimer.current = window.setTimeout(() => {
      setCelebrate(false)
      celebrateTimer.current = null
    }, 2600) as unknown as number
  }

  const follow = async (id: string) => {
    if (pending[id]) return
    setPending(s => ({ ...s, [id]: true }))
    setFollowing(s => ({ ...s, [id]: true })) // optimistic
    try {
      const url = `/api/scout/follow?player_id=${encodeURIComponent(id)}`
      const res = await fetch(url, { method: "POST" })
      if (!res.ok) {
        setFollowing(s => ({ ...s, [id]: false }))
        let msg = t("discover.errors.couldNotAdd")
        try { const b = await res.json(); msg = b?.error || msg } catch {}
        throw new Error(msg)
      }
      setInterest(i => ({ ...i, [id]: (i[id] ?? 0) + 1 }))
      toast.success(t("discover.toasts.added"))
      triggerCelebration()
    } catch (e: any) {
      toast.error(e?.message || t("discover.errors.couldNotAdd"))
    } finally {
      setPending(s => ({ ...s, [id]: false }))
    }
  }

  const unfollow = async (id: string) => {
    if (pending[id]) return
    setPending(s => ({ ...s, [id]: true }))
    setFollowing(s => ({ ...s, [id]: false })) // optimistic
    try {
      const url = `/api/scout/follow?player_id=${encodeURIComponent(id)}`
      const res = await fetch(url, { method: "DELETE" })
      if (!res.ok) {
        setFollowing(s => ({ ...s, [id]: true }))
        let msg = t("discover.errors.couldNotRemove")
        try { const b = await res.json(); msg = b?.error || msg } catch {}
        throw new Error(msg)
      }
      setInterest(i => ({ ...i, [id]: Math.max(0, (i[id] ?? 0) - 1) }))
      toast.success(t("discover.toasts.removed"))
    } catch (e: any) {
      toast.error(e?.message || t("discover.errors.couldNotRemove"))
    } finally {
      setPending(s => ({ ...s, [id]: false }))
    }
  }

  // ---- Compare helpers ----
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else {
        if (next.size >= MAX_COMPARE) {
          toast.message(
            t("discover.compare.max", {max: MAX_COMPARE}),
            { description: t("discover.compare.removeOne") }
          )
          return next
        }
        next.add(id)
      }
      return next
    })
  }
  const clearSelection = () => setSelected(new Set())

  const openCompare = async () => {
    const ids = Array.from(selected)
    if (ids.length < 2) {
      toast.message(t("discover.compare.needTwo"))
      return
    }
    setCompareOpen(true)
    setCompareLoading(true)
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await fetch(`/api/players/${id}/details`, { cache: "no-store" })
            if (!r.ok) return [id, null] as const
            const j = await r.json()
            return [id, j] as const
          } catch {
            return [id, null] as const
          }
        })
      )
      const merged: Record<string, any> = {}
      for (const [id, payload] of results) merged[id] = payload
      setDetails(merged)
    } finally {
      setCompareLoading(false)
    }
  }

  const formatVal = (v: any) => {
    if (v == null || v === "") return t("ui.na")
    if (typeof v === "boolean") return v ? t("ui.yes") : t("ui.no")
    return String(v)
  }

  const getDetail = (id: string, key: string) => {
    const base = items.find(p => p.id === id)
    const d = details[id] || {}
    const map: Record<string, any> = {
      name: base?.full_name ?? d.full_name ?? d.name,
      position: base?.main_position ?? d.main_position ?? d.position ?? d?.position?.main,
      club: base?.current_club_name ?? d.current_club_name ?? d?.club?.name,
      country: base?.current_club_country ?? d.current_club_country ?? d?.placeOfBirth?.country,
      dob: d.date_of_birth ?? d.dateOfBirth ?? d?.birthDate,
      height_cm: d.height_cm ?? d.height ?? d?.height_cm,
      weight_kg: d.weight_kg ?? d.weight ?? d?.weight_kg,
      foot: d.dominant_foot ?? d.foot,
      market_value: d.market_value ?? d.marketValue,
      tm: base?.transfermarkt_url ?? d.transfermarkt_url ?? d.url,
    }
    return map[key]
  }

  useEffect(() => {
    return () => {
      if (celebrateTimer.current) {
        window.clearTimeout(celebrateTimer.current)
        celebrateTimer.current = null
      }
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        {/* Left cluster: search + filters */}
        <div className="flex w-full flex-col gap-3">
          {/* Main Search / Add input – highlighted */}
          <div className="relative">
            {/* halo wrapper */}
            <div className="animate-glow-once rounded-lg bg-gradient-to-r from-primary/30 via-primary/10 to-emerald-400/30 p-[1.5px] focus-within:from-primary/50 focus-within:to-emerald-400/50">
              <div className="relative rounded-[9px] bg-background">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-10 w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
                  placeholder={t("discover.search.placeholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); fetchPage(true) } }}
                  aria-label={t("discover.search.aria")}
                  style={{paddingLeft:"30px"}}
                />
                {/* mini floating label */}
                <span className="pointer-events-none absolute -top-2.5 left-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm">
                  {t("discover.search.label")}
                </span>
              </div>
            </div>

            {/* helper row under input on small screens */}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              {t.rich("discover.search.helper", {
                kbd: (chunks) => <kbd className="rounded border px-1.5 py-0.5 text-[10px]">{chunks}</kbd>,
                em: (chunks) => <em>{chunks}</em>
              })}
            </div>
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Country */}
            <div className="relative">
              <Globe className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                className="pl-8 w-40"
                placeholder={t("discover.filters.country")}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>

            {/* Sort segmented */}
            <div className="inline-flex items-center gap-1 rounded-md border p-1">
              {(["newest","name","interest"] as SortKey[]).map((k) => (
                <Button
                  key={k}
                  type="button"
                  size="sm"
                  variant={sort === k ? "default" : "ghost"}
                  className="px-3"
                  aria-pressed={sort === k}
                  onClick={() => setSort(k)}
                >
                  {k === "newest" ? t("discover.sort.newest") : k === "name" ? t("discover.sort.name") : t("discover.sort.interest")}
                </Button>
              ))}
            </div>

            {/* Reset */}
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => { setSearch(""); setPosition("any"); setCountry(""); setSort("newest") }}
              title={t("discover.filters.reset")}
            >
              <Filter className="h-4 w-4" /> {t("discover.filters.reset")}
            </Button>
          </div>
        </div>

        {/* Right cluster: view toggle */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-md border p-1">
            <Button
              type="button"
              size="sm"
              variant={view === "cards" ? "default" : "ghost"}
              className="px-3"
              aria-pressed={view === "cards"}
              onClick={() => setView("cards")}
              title={t("discover.view.cardTitle")}
            >
              <LayoutGrid className="mr-1 h-4 w-4" /> {t("discover.view.cards")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "table" ? "default" : "ghost"}
              className="px-3"
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
              title={t("discover.view.tableTitle")}
            >
              <TableIcon className="mr-1 h-4 w-4" /> {t("discover.view.table")}
            </Button>
          </div>
        </div>
      </div>

      {/* Sync toolbar */}
      <Card className="p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap">
          <div className="text-sm text-muted-foreground">{t("discover.sync.title")}</div>

          <div className="inline-flex items-center gap-1 rounded-md border p-1">
            {(["players","clubs","competitions"] as SyncMode[]).map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={syncMode === m ? "default" : "ghost"}
                className="px-3"
                aria-pressed={syncMode === m}
                onClick={() => setSyncMode(m)}
              >
                {m === "players" ? t("discover.sync.mode.players") : m === "clubs" ? t("discover.sync.mode.clubs") : t("discover.sync.mode.competitions")}
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            className="gap-2"
            onClick={syncFromTransfermarkt}
            disabled={syncing || !search.trim()}
            title={t("discover.sync.tip")}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {syncing ? t("discover.sync.synchronizing") : t("discover.sync.synchronize")}
          </Button>

          <div className="md:ml-auto" />

          <Button
            variant="outline"
            className="gap-2"
            onClick={syncMissing}
            disabled={bulkSyncing}
            title={t("discover.sync.missingTip")}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {bulkSyncing ? t("discover.sync.syncingMissing") : t("discover.sync.syncMissing")}
          </Button>
        </div>
      </Card>

      {/* Results header + active chips */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="order-2 text-sm text-muted-foreground sm:order-1">
          {loading ? t("loading.loading") : t("discover.results.count", {count: items.length})}
        </div>
        <div className="order-1 -mx-1 overflow-x-auto no-scrollbar sm:order-2">
          <div className="flex gap-2 px-1">
            {[
              ...(search ? [{ label: t("discover.chips.search", {q: search}), clear: () => setSearch("") }] : []),
              ...(position !== "any" ? [{ label: t("discover.chips.position", {pos: position}), clear: () => setPosition("any") }] : []),
              ...(country ? [{ label: t("discover.chips.country", {country}), clear: () => setCountry("") }] : []),
              ...(sort !== "newest" ? [{ label: t("discover.chips.sort", {
                sort: sort === "newest" ? t("discover.sort.newest") : sort === "name" ? t("discover.sort.name") : t("discover.sort.interest")
              }), clear: () => setSort("newest") }] : []),
            ].map((f) => (
              <Badge key={f.label} variant="secondary" className="flex items-center gap-1">
                {f.label}
                <button
                  className="ml-1 rounded p-0.5 hover:bg-muted"
                  onClick={f.clear}
                  aria-label={t("discover.filters.clear", {label: f.label})}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Error card */}
      {error && (
        <Card className="p-4 border-destructive/30">
          <div className="flex items-center justify-between gap-3">
            <div className="truncate text-sm text-red-600">{t("discover.error.prefix")} {error}</div>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => fetchPage(true)} disabled={loading}>
              <RotateCw className="h-4 w-4" /> {t("actions.retry")}
            </Button>
          </div>
        </Card>
      )}

      {/* ==== VIEW: CARDS ==== */}
      {view === "cards" && (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {/* skeletons */}
            {loading && !hasItems &&
              Array.from({ length: 10 }).map((_, i) => (
                <Card key={`s-${i}`} className="rounded-2xl p-4 shadow-sm">
                  <div className="animate-pulse space-y-3">
                    <div className="h-40 w-full rounded-xl bg-muted" />
                    <div className="h-4 w-2/3 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                    <div className="h-8 w-full rounded bg-muted" />
                  </div>
                </Card>
              ))
            }

            {/* No results */}
            {!loading && !hasItems && !error && (
              <Card className="col-span-full rounded-2xl p-8 text-center shadow-sm">
                <div className="mb-1 text-lg font-medium">{t("discover.empty.title")}</div>
                <div className="mb-4 text-sm text-muted-foreground">
                  {search.trim()
                    ? t.rich("discover.empty.bodyQuery", {q: () => <span className="font-medium">“{search}”</span>})
                    : t("discover.empty.bodyNoQuery")}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => { setSearch(""); setPosition("any"); setCountry(""); setSort("newest") }}
                    className="gap-2"
                  >
                    <Filter className="h-4 w-4" /> {t("discover.filters.reset")}
                  </Button>
                  <Button
                    onClick={syncFromTransfermarkt}
                    disabled={!search.trim() || syncing}
                    className="gap-2"
                    title={t("discover.sync.tip")}
                  >
                    <RefreshCw className="h-4 w-4" />
                    {syncing ? t("discover.sync.synchronizing") : t("discover.empty.syncButton", {q: search.trim() || "name"})}
                  </Button>
                </div>
              </Card>
            )}

            {visible.map((p) => {
              const isFollowing = !!following[p.id]
              const interestCount = interest[p.id] ?? 0
              const isPending = !!pending[p.id]
              const isSelected = selected.has(p.id)

              return (
                <Card key={p.id} className="relative rounded-2xl p-4 shadow-sm transition hover:shadow-md">
                  {/* Select checkbox */}
                  <label className="absolute left-2 top-2 z-10 inline-flex items-center gap-2 rounded border bg-background/70 px-2 py-1 text-xs">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(p.id)}
                      className="accent-foreground"
                    />
                    {t("discover.select")}
                  </label>

                  <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image_url || "/placeholder.svg"}
                      alt={p.full_name}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  {/* Details */}
                  <div className="mt-3">
                    <div className="truncate font-semibold leading-tight">{p.full_name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.current_club_name ?? t("discover.player.unknownClub")}
                      {p.current_club_country ? ` · ${p.current_club_country}` : ""}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {p.main_position && <Badge variant="secondary">{p.main_position}</Badge>}
                      <Badge variant="outline" className="gap-1" title={t("discover.player.scoutsTitle")}>
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only">{t("discover.player.scoutsSr")}</span>
                        {t("discover.player.scouts")} {interestCount}
                      </Badge>
                      {p.transfermarkt_url && (
                        <a
                          href={p.transfermarkt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs underline text-muted-foreground hover:text-foreground"
                        >
                          Transfermarkt <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3">
                    {isFollowing ? (
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => unfollow(p.id)}
                        disabled={loading || isPending}
                      >
                        <Check className="h-4 w-4" /> {t("discover.actions.inMyPlayersRemove")}
                      </Button>
                    ) : (
                      <Button
                        className="w-full gap-2"
                        onClick={() => follow(p.id)}
                        disabled={loading || isPending}
                        aria-live="polite"
                      >
                        <Plus className="h-4 w-4" /> {isPending ? t("discover.actions.adding") : t("discover.actions.addToMyPlayers")}
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {/* ==== VIEW: TABLE ==== */}
      {view === "table" && (
        <div className="-mx-2 overflow-x-auto sm:mx-0">
          <table className="min-w-[900px] w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b">
                <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">{t("table.headers.select")}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">{t("table.headers.player")}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">{t("table.headers.position")}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">{t("table.headers.club")}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">{t("table.headers.country")}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">{t("table.headers.interest")}</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">{t("table.headers.transfermarkt")}</th>
                <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">{t("table.headers.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {/* skeleton rows */}
              {loading && !hasItems && Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-b">
                  <td className="px-2 py-3"><div className="h-4 w-4 rounded bg-muted" /></td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded bg-muted" />
                      <div className="h-4 w-40 rounded bg-muted" />
                    </div>
                  </td>
                  <td className="px-2 py-3"><div className="h-4 w-16 rounded bg-muted" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-24 rounded bg-muted" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-20 rounded bg-muted" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-12 rounded bg-muted" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-16 rounded bg-muted" /></td>
                  <td className="px-2 py-3 text-right"><div className="ml-auto h-8 w-24 rounded bg-muted" /></td>
                </tr>
              ))}

              {!loading && !hasItems && !error && (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-sm text-muted-foreground">
                    {t("discover.empty.table")}
                  </td>
                </tr>
              )}

              {visible.map((p) => {
                const isFollowing = !!following[p.id]
                const interestCount = interest[p.id] ?? 0
                const isPending = !!pending[p.id]
                const isSelected = selected.has(p.id)

                return (
                  <tr key={p.id} className="border-b hover:bg-muted/40">
                    <td className="px-2 py-3 align-middle">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(p.id)}
                        className="accent-foreground"
                        aria-label={t("table.selectAria", {name: p.full_name})}
                      />
                    </td>
                    <td className="px-2 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.image_url || "/placeholder.svg"}
                          alt={p.full_name}
                          className="h-10 w-10 rounded object-cover"
                        />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{p.full_name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {p.current_club_name ?? t("discover.player.unknownClub")}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3 align-middle">{p.main_position ?? t("ui.na")}</td>
                    <td className="px-2 py-3 align-middle">{p.current_club_name ?? t("ui.na")}</td>
                    <td className="px-2 py-3 align-middle">{p.current_club_country ?? t("ui.na")}</td>
                    <td className="px-2 py-3 align-middle">
                      <Badge variant="outline" className="gap-1">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" /> {interestCount}
                      </Badge>
                    </td>
                    <td className="px-2 py-3 align-middle">
                      {p.transfermarkt_url ? (
                        <a href={p.transfermarkt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                          {t("ui.open")} <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : t("ui.na")}
                    </td>
                    <td className="px-2 py-3 text-right align-middle">
                      {isFollowing ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => unfollow(p.id)}
                          disabled={loading || isPending}
                        >
                          <Check className="h-4 w-4" /> {t("discover.actions.inList")}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="gap-2"
                          onClick={() => follow(p.id)}
                          disabled={loading || isPending}
                        >
                          <Plus className="h-4 w-4" /> {t("discover.actions.add")}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Load more */}
      <div className="flex justify-center">
        {hasItems && (
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading ? t("loading.loading") : t("actions.loadMore")}
          </Button>
        )}
      </div>

      {/* Sticky compare bar */}
      {selected.size >= 2 && (
        <div className="fixed inset-x-2 bottom-2 z-50 md:inset-x-4 md:bottom-4">
          <Card className="p-3 shadow-lg">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-sm">
                {t("discover.compare.selected", {count: selected.size, max: MAX_COMPARE})}
              </div>
              <div className="flex gap-2">
                <Button className="gap-2" onClick={openCompare}>
                  <ArrowLeftRight className="h-4 w-4" /> {t("discover.compare.compare")}
                </Button>
                <Button variant="outline" onClick={clearSelection}>
                  {t("actions.clear")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Compare overlay */}
      {compareOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCompareOpen(false)} />
          <div className="absolute inset-0 overflow-auto bg-background p-4 md:inset-x-4 md:top-8 md:bottom-8 md:rounded-2xl md:shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="font-semibold">{t("discover.compare.title")}</div>
              <Button variant="ghost" size="icon" onClick={() => setCompareOpen(false)} aria-label={t("ui.close")}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {compareLoading ? (
              <div className="text-sm text-muted-foreground">{t("discover.compare.loading")}</div>
            ) : (
              <div className="w-full overflow-auto">
                <table className="min-w-[700px] w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr>
                      <th className="w-36 px-2 py-2 text-left text-xs font-medium text-muted-foreground">{t("discover.compare.field")}</th>
                      {Array.from(selected).map((id) => (
                        <th key={id} className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                          {formatVal(getDetail(id, "name"))}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      [t("discover.compare.fields.position"), "position"],
                      [t("discover.compare.fields.club"), "club"],
                      [t("discover.compare.fields.country"), "country"],
                      [t("discover.compare.fields.dob"), "dob"],
                      [t("discover.compare.fields.height"), "height_cm"],
                      [t("discover.compare.fields.weight"), "weight_kg"],
                      [t("discover.compare.fields.foot"), "foot"],
                      [t("discover.compare.fields.marketValue"), "market_value"],
                      [t("discover.compare.fields.transfermarkt"), "tm"],
                    ].map(([label, key]) => (
                      <tr key={key as string}>
                        <td className="py-2 px-2 text-xs text-muted-foreground">{label}</td>
                        {Array.from(selected).map((id) => {
                          const v = getDetail(id, key as string)
                          return (
                            <td key={id} className="py-2 px-2 text-sm">
                              {key === "tm" && typeof v === "string" ? (
                                <a href={v} target="_blank" rel="noreferrer" className="underline">
                                  {t("ui.open")}
                                </a>
                              ) : (
                                formatVal(v)
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
