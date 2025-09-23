// src/app/scout/observations/[id]/AddPlayerLive.client.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/browser"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Search, Users } from "lucide-react"

type Result =
  | { kind: "player"; id: string; name: string; club?: string | null; img?: string | null }
  | { kind: "entry"; id: string; name: string; club?: string | null; img?: string | null }

export default function AddPlayerLive({ observationId, onAdded }: {
  observationId: string
  onAdded?: () => void
}) {
  const supabase = createClient()
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Result[]>([])
  const [open, setOpen] = useState(false)

  // debounce q
  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim()
      if (!term) { setResults([]); setOpen(false); return }
      setLoading(true)
      try {
        const [a, b] = await Promise.all([
          supabase.from("players")
            .select("id, full_name, current_club_name, image_url")
            .ilike("full_name", `%${term}%`)
            .limit(10),
          supabase.from("scout_player_entries")
            .select("id, full_name, current_club_name, image_url")
            .ilike("full_name", `%${term}%`)
            .limit(10),
        ])

        const merge: Result[] = [
          ...(a.data ?? []).map(p => ({
            kind: "player" as const,
            id: p.id,
            name: p.full_name,
            club: (p as any).current_club_name,
            img: (p as any).image_url,
          })),
          ...(b.data ?? []).map(e => ({
            kind: "entry" as const,
            id: e.id,
            name: e.full_name,
            club: (e as any).current_club_name,
            img: (e as any).image_url,
          })),
        ]
        setResults(merge)
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const addToObservation = async (r: Result) => {
    try {
      const res = await fetch(`/scout/observations/${observationId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          r.kind === "entry"
            ? { player_entry_id: r.id }
            : { player_id: r.id }
        ),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || "Failed to add")
      toast.success("Player added to observation")
      setQ("")
      setOpen(false)
      setResults([])
      onAdded?.()
    } catch (e: any) {
      toast.error(e.message || "Failed to add")
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search players or entries…"
          className="pl-8"
          onFocus={() => { if (results.length) setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
        />
      </div>

      {open && (
        <Card className="absolute z-20 mt-1 w-full overflow-hidden">
          <div className="max-h-72 overflow-auto">
            {loading && (
              <div className="p-3 text-xs text-muted-foreground">Searching…</div>
            )}
            {!loading && results.length === 0 && (
              <div className="p-3 text-xs text-muted-foreground">No matches</div>
            )}
            {!loading && results.map((r) => (
              <button
                key={`${r.kind}-${r.id}`}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addToObservation(r)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.img || "/placeholder.svg"}
                  alt=""
                  className="h-8 w-8 rounded object-cover border"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.club || "—"}</div>
                </div>
                <div className="ml-auto">
                  <Badge variant="secondary" className="text-[10px]">
                    {r.kind === "entry" ? "Entry" : "Player"}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
