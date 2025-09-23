"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Search, Users, Globe, ExternalLink, Filter, RotateCw } from "lucide-react"

type Player = {
  id: string
  full_name: string
  main_position: string | null
  current_club_name: string | null
  current_club_country: string | null
  image_url: string | null
  transfermarkt_url: string | null
}

const POSITIONS = ["GK","RB","CB","LB","RWB","LWB","DM","CM","AM","RW","LW","CF","ST"] as const
type SortKey = "newest" | "name" | "interest"

export default function AdminPlayersGrid() {
  // filters/state
  const [search, setSearch] = useState("")
  const [position, setPosition] = useState<string>("any")
  const [country, setCountry] = useState<string>("")
  const [sort, setSort] = useState<SortKey>("newest")

  // data
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Player[]>([])
  const [interest, setInterest] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const hasItems = items.length > 0

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

  const fetchPage = async (reset = false) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      // Reuse the same backend as Discover so logic stays in one place
      const res = await fetch(`/api/scout/discover?${queryString}`, {
        cache: "no-store",
        signal: controller.signal,
      })
      if (!res.ok) {
        let msg = res.statusText || `HTTP ${res.status}`
        try { const j = await res.json(); msg = j?.error || msg } catch {}
        throw new Error(msg)
      }
      const data = await res.json()
      // we ignore "following" on admin page
      setInterest(prev => (reset ? (data.interest || {}) : { ...prev, ...(data.interest || {}) }))
      setItems(prev => (reset ? (data.players || []) : [...prev, ...(data.players || [])]))
    } catch (e: any) {
      if (e?.name === "AbortError") return
      setError(e?.message || "Failed to load players")
      toast.error(e?.message || "Failed to load players")
    } finally {
      setLoading(false)
    }
  }

  // initial + on filter change (debounced) -> reset list
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchPage(true) }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, position, country, sort])

  // pagination
  useEffect(() => {
    if (page > 1) fetchPage(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const visible = useMemo(() => {
    if (sort !== "interest") return items
    return [...items].sort((a, b) => (interest[b.id] ?? 0) - (interest[a.id] ?? 0))
  }, [items, sort, interest])

  return (
    <div className="space-y-6">
      {/* Header + filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="text-2xl font-semibold">All Players</div>

        <div className="flex items-center gap-2 flex-1 md:ml-4">
          {/* Search */}
          <div className="relative w-full">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search player name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Position segmented buttons */}
          <div className="inline-flex items-center gap-1 overflow-x-auto rounded-md border p-1 max-w-full">
            <Button
              type="button" size="sm"
              variant={position === "any" ? "default" : "ghost"}
              className="px-3" aria-pressed={position === "any"}
              onClick={() => setPosition("any")}
              title="Any position"
            >Any</Button>
            {POSITIONS.map((p) => (
              <Button
                key={p} type="button" size="sm"
                variant={position === p ? "default" : "ghost"}
                className="px-3" aria-pressed={position === p}
                onClick={() => setPosition(p)} title={p}
              >{p}</Button>
            ))}
          </div>

          {/* Country */}
          <div className="relative">
            <Globe className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 w-40"
              placeholder="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>

          {/* Sort segmented buttons */}
          <div className="inline-flex items-center gap-1 rounded-md border p-1">
            {(["newest","name","interest"] as SortKey[]).map((k) => (
              <Button
                key={k} type="button" size="sm"
                variant={sort === k ? "default" : "ghost"}
                className="px-3" aria-pressed={sort === k}
                onClick={() => setSort(k)}
              >
                {k === "newest" ? "Newest" : k === "name" ? "Name" : "Interest"}
              </Button>
            ))}
          </div>

          {/* Reset */}
          <Button
            variant="outline" className="gap-2"
            onClick={() => { setSearch(""); setPosition("any"); setCountry(""); setSort("newest") }}
            title="Reset filters"
          >
            <Filter className="h-4 w-4" /> Reset
          </Button>
        </div>
      </div>

      {/* Error card (retry) */}
      {error && (
        <Card className="p-4 border-destructive/30">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-red-600 truncate">Error: {error}</div>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => fetchPage(true)} disabled={loading}>
              <RotateCw className="h-4 w-4" /> Retry
            </Button>
          </div>
        </Card>
      )}

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* loading skeletons */}
        {loading && !hasItems &&
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={`s-${i}`} className="p-4 rounded-2xl shadow-sm">
              <div className="animate-pulse space-y-3">
                <div className="h-40 w-full rounded-xl bg-muted" />
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
                <div className="h-8 w-full rounded bg-muted" />
              </div>
            </Card>
          ))
        }

        {!loading && !hasItems && !error && (
          <Card className="p-8 rounded-2xl shadow-sm col-span-full text-center">
            <div className="text-lg font-medium mb-1">No players found</div>
            <div className="text-sm text-muted-foreground">
              Try adjusting your filters or search query.
            </div>
          </Card>
        )}

        {visible.map((p) => (
          <Card key={p.id} className="p-4 rounded-2xl shadow-sm hover:shadow-md transition">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.image_url || "/placeholder.svg"}
                alt={p.full_name}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="mt-3 flex items-start gap-3">
              <div className="min-w-0">
                <div className="font-semibold leading-tight truncate">{p.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {p.current_club_name ?? "Unknown club"}
                  {p.current_club_country ? ` · ${p.current_club_country}` : ""}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.main_position && <Badge variant="secondary">{p.main_position}</Badge>}
                  <Badge variant="outline" className="gap-1">
                    <Users className="h-3.5 w-3.5" /> {interest[p.id] ?? 0}
                  </Badge>
                  {p.transfermarkt_url && (
                    <a
                      href={p.transfermarkt_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs inline-flex items-center gap-1 underline text-muted-foreground hover:text-foreground"
                    >
                      Transfermarkt <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Load more */}
      <div className="flex justify-center">
        {hasItems && (
          <Button variant="outline" onClick={() => setPage(p => p + 1)} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        )}
      </div>
    </div>
  )
}
