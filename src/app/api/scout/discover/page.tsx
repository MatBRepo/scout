// src/app/scout/discover/page.tsx
"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  Search,
  Users,
  Globe,
  ExternalLink,
  Plus,
  Check,
  Filter,
  RotateCw,
  RefreshCw,
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
const POSITIONS = ["GK","RB","CB","LB","RWB","LWB","DM","CM","AM","RW","LW","CF","ST"] as const
type SortKey = "newest" | "name" | "interest"
export default function DiscoverPlayersPage() {
  // filters/state
  const [search, setSearch] = useState("")
  const [position, setPosition] = useState<string>("any") // ✅ never empty
  const [country, setCountry] = useState<string>("")
  const [sort, setSort] = useState<SortKey>("newest")
  // data
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Player[]>([])
  const [following, setFollowing] = useState<Record<string, boolean>>({})
  const [interest, setInterest] = useState<Record<string, number>>({})
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
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
        let message = res.statusText || `HTTP ${res.status}`
        try {
          const j = await res.json()
          message = j?.error || message
        } catch {}
        throw new Error(message)
      }
      const data = await res.json()
      setFollowing(prev => (reset ? data.following : { ...prev, ...data.following }))
      setInterest(prev => (reset ? data.interest  : { ...prev, ...data.interest }))
      setItems(prev => (reset ? data.players : [...prev, ...(data.players ?? [])]))
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
    const t = setTimeout(() => {
      setPage(1)
      fetchPage(true)
    }, 250)
    return () => clearTimeout(t)
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
const syncFromTransfermarkt = async () => {
  const name = search.trim()
  if (!name) {
    toast.message("Type a player name first", { description: "Synchronize uses your current search query." })
    return
  }
  setSyncing(true)
  try {
    const res = await fetch("/api/admin/transfermarkt/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: name }),   // ✅ new contract
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || "Sync failed")
    toast.success(`Imported ${body.imported ?? 0} • matched ${body.matched ?? 0}`)
    setPage(1)
    await fetchPage(true)
  } catch (e: any) {
    toast.error(e?.message || "Sync failed")
  } finally {
    setSyncing(false)
  }
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
        let msg = "Could not add"
        try {
          const b = await res.json()
          msg = b?.error || msg
        } catch {}
        throw new Error(msg)
      }
      setInterest(i => ({ ...i, [id]: (i[id] ?? 0) + 1 }))
      toast.success("Added to My Players")
    } catch (e: any) {
      toast.error(e.message)
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
        let msg = "Could not remove"
        try {
          const b = await res.json()
          msg = b?.error || msg
        } catch {}
        throw new Error(msg)
      }
      setInterest(i => ({ ...i, [id]: Math.max(0, (i[id] ?? 0) - 1) }))
      toast.success("Removed from My Players")
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setPending(s => ({ ...s, [id]: false }))
    }
  }
  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex items-center gap-2 flex-1">
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
          {/* Position (never empty) */}
          <Select value={position} onValueChange={setPosition}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
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
          {/* Sort (never empty) */}
          <Select value={sort} onValueChange={(v: SortKey) => setSort(v)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="name">Name (A–Z)</SelectItem>
              <SelectItem value="interest">Interest</SelectItem>
            </SelectContent>
          </Select>
          {/* Reset */}
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => { setSearch(""); setPosition("any"); setCountry(""); setSort("newest") }}
            title="Reset filters"
          >
            <Filter className="h-4 w-4" /> Reset
          </Button>
          {/* Synchronize (admin) */}
          <Button
            variant="outline"
            className="gap-2"
            onClick={syncFromTransfermarkt}
            disabled={syncing}
            title="Import from Transfermarkt using current Search"
          >
            <RefreshCw className="h-4 w-4" />
            {syncing ? "Synchronizing…" : "Synchronize"}
          </Button>
        </div>
      </div>
      {/* Error card */}
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
        {/* skeletons */}
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
        {visible.map((p) => {
          const isFollowing = !!following[p.id]
          const interestCount = interest[p.id] ?? 0
          const isPending = !!pending[p.id]
          return (
            <Card key={p.id} className="p-4 rounded-2xl shadow-sm hover:shadow-md transition">
              <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border bg-muted relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image_url || "/placeholder.svg"}
                  alt={p.full_name}
                  className="h-full w-full object-cover"
                />
                {/* Per-player refresh (admin) */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 bg-background/70"
                  title="Refresh from Transfermarkt"
                  onClick={async () => {
                    const r = await fetch(`/api/admin/players/${p.id}/sync`, { method: "POST" })
                    const j = await r.json().catch(() => ({}))
                    if (!r.ok) return toast.error(j.error || "Sync failed")
                    toast.success("Player updated")
                    if (j.player) setItems(list => list.map(x => x.id === p.id ? { ...x, ...j.player } : x))
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
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
                      <Users className="h-3.5 w-3.5" /> {interestCount}
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
              <div className="mt-3">
                {isFollowing ? (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => unfollow(p.id)}
                    disabled={loading || isPending}
                  >
                    <Check className="h-4 w-4" /> In My Players — Remove
                  </Button>
                ) : (
                  <Button
                    className="w-full gap-2"
                    onClick={() => follow(p.id)}
                    disabled={loading || isPending}
                  >
                    <Plus className="h-4 w-4" /> {isPending ? "Adding…" : "Add to My Players"}
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
      {/* Load more */}
      <div className="flex justify-center">
        {hasItems && (
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        )}
      </div>
    </div>
  )
}
