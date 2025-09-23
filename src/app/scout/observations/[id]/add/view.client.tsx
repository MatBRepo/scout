"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/browser"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Search, ExternalLink, ArrowLeft } from "lucide-react"
import Link from "next/link"

type Session = {
  id: string
  competition?: string | null
  opponent?: string | null
  match_date?: string | null
}

export default function AddToObservation({
  observationId,
  session,
}: {
  observationId: string
  session: Session
}) {
  const supabase = createClient()
  const router = useRouter()

  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<"players" | "entries">("players")
  const [rows, setRows] = useState<any[]>([])

  const title = useMemo(() => {
    const d = session.match_date ? new Date(session.match_date).toLocaleDateString() : null
    return [session.competition, session.opponent ? `vs ${session.opponent}` : null, d].filter(Boolean).join(" • ")
  }, [session])

  const search = async () => {
    setLoading(true)
    try {
      if (tab === "players") {
        const { data, error } = await supabase
          .from("players")
          .select("id, full_name, image_url, transfermarkt_url, current_club_name, main_position")
          .ilike("full_name", `%${q}%`)
          .order("full_name", { ascending: true })
          .limit(30)
        if (error) throw error
        setRows(data || [])
      } else {
        const { data, error } = await supabase
          .from("scout_player_entries")
          .select("id, full_name, image_url, transfermarkt_url, current_club_name, main_position")
          .ilike("full_name", `%${q}%`)
          .order("updated_at", { ascending: false })
          .limit(30)
        if (error) throw error
        setRows(data || [])
      }
    } catch (e: any) {
      toast.error(e?.message || "Search failed")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(search, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tab])

  const addRow = async (row: any) => {
    try {
      const payload =
        tab === "players"
          ? { player_id: row.id }
          : { player_entry_id: row.id }

      const r = await fetch(`/api/scout/observations/${observationId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || "Add failed")

      toast.success("Player added to observation")
      router.push(`/scout/observations/${observationId}`)
    } catch (e: any) {
      toast.error(e?.message || "Add failed")
    }
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">
            <Link href={`/scout/observations/${observationId}`} className="inline-flex items-center gap-1 hover:underline">
              <ArrowLeft className="h-4 w-4" /> Back to Observation
            </Link>
          </div>
          <h1 className="text-xl font-semibold">Add player to observation</h1>
          {title && <div className="text-xs text-muted-foreground">{title}</div>}
        </div>

        <div className="inline-flex rounded-md border p-1">
          <Button
            size="sm"
            variant={tab === "players" ? "default" : "ghost"}
            onClick={() => setTab("players")}
          >
            Players
          </Button>
          <Button
            size="sm"
            variant={tab === "entries" ? "default" : "ghost"}
            onClick={() => setTab("entries")}
          >
            My Entries
          </Button>
        </div>
      </div>

      {/* search */}
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder={tab === "players" ? "Search players…" : "Search my entries…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
      </div>

      {/* results */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading &&
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-40 w-full rounded-xl bg-muted" />
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
                <div className="h-9 w-full rounded bg-muted" />
              </div>
            </Card>
          ))
        }

        {!loading && rows.length === 0 && (
          <Card className="p-8 text-center col-span-full">
            <div className="text-sm text-muted-foreground">No results yet — try searching.</div>
          </Card>
        )}

        {rows.map((r) => (
          <Card key={r.id} className="p-4 rounded-2xl shadow-sm hover:shadow-md transition">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.image_url || "/placeholder.svg"} alt={r.full_name} className="h-full w-full object-cover" />
            </div>
            <div className="mt-3">
              <div className="font-semibold leading-tight truncate">{r.full_name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {r.current_club_name || "—"}
              </div>
              <div className="mt-2 flex items-center gap-2">
                {r.main_position && <Badge variant="secondary">{r.main_position}</Badge>}
                {r.transfermarkt_url && (
                  <a href={r.transfermarkt_url} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 underline text-muted-foreground hover:text-foreground">
                    Transfermarkt <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>

            <div className="mt-3">
              <Button className="w-full" onClick={() => addRow(r)}>
                Add to observation
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
