"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { Search, Shield } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Scout = {
  id: string
  full_name: string | null
  avatar_url: string | null
  country: string | null
  agency: string | null
  role: "scout" | "admin" | "" | null
  is_active: boolean
  created_at: string
  myPlayersCount: number
  entriesCount: number
}

export default function ScoutsTable() {
  const [q, setQ] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | "scout" | "admin">("all")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Scout[]>([])
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const debounceRef = useRef<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const url = new URL("/api/admin/scouts/list", location.origin)
      if (q.trim()) url.searchParams.set("q", q.trim())
      if (roleFilter !== "all") url.searchParams.set("role", roleFilter)
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
  useEffect(() => { load() }, [roleFilter]) // eslint-disable-line react-hooks/exhaustive-deps
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

  const setRole = async (id: string, role: "scout" | "admin") => {
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
      toast.success(role === "admin" ? "Promoted to admin" : "Demoted to scout")
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setPending(s => ({ ...s, [id]: false }))
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search name, agency, country…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {/* Segmented role filter (buttons) */}
        <div className="inline-flex rounded-md border p-1">
          {(["all","scout","admin"] as const).map(v => (
            <Button
              key={v}
              type="button"
              size="sm"
              variant={roleFilter === v ? "default" : "ghost"}
              className="px-3"
              aria-pressed={roleFilter === v}
              onClick={() => setRoleFilter(v)}
            >
              {v === "all" ? "All" : v[0].toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </div>

        <Button variant="outline" onClick={() => { setQ(""); setRoleFilter("all"); load() }} disabled={loading}>
          Reset
        </Button>
        <Button onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</Button>
      </div>

      {/* Grid list */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map(s => {
          const isBusy = !!pending[s.id]
          const safeRole: "scout" | "admin" = s.role === "admin" ? "admin" : "scout"

          return (
            <Card key={s.id} className="p-4 rounded-2xl shadow-sm flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.avatar_url || "/placeholder.svg"}
                alt={s.full_name ?? "Scout"}
                className="h-14 w-14 rounded-full object-cover border"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-medium truncate">{s.full_name ?? "(no name)"}</div>
                  {safeRole === "admin" ? (
                    <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" /> Admin</Badge>
                  ) : (
                    <Badge variant="outline">Scout</Badge>
                  )}
                  {!s.is_active && <Badge variant="destructive">Inactive</Badge>}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {s.agency || "—"}{s.country ? ` · ${s.country}` : ""}
                </div>
                <div className="text-xs mt-1 text-muted-foreground">
                  My Players: {s.myPlayersCount} · Entries: {s.entriesCount}
                </div>

                <div className="mt-3 flex gap-2">
                  {/* Role changer (Dropdown Menu) */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 w-36" disabled={isBusy}>
                        Role: {safeRole === "admin" ? "Admin" : "Scout"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-36">
                      <DropdownMenuItem onClick={() => !isBusy && setRole(s.id, "scout")}>
                        Set as Scout
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => !isBusy && setRole(s.id, "admin")}>
                        Set as Admin
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

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
            </Card>
          )
        })}

        {!filtered.length && (
          <Card className="p-8 rounded-2xl shadow-sm col-span-full text-center text-sm text-muted-foreground">
            No scouts found.
          </Card>
        )}
      </div>
    </div>
  )
}
