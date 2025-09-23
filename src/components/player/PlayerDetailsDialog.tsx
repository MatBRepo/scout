// src/components/player/PlayerDetailsDialog.tsx
"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"
import { toast } from "sonner"

type Props = {
  playerId: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
}

export default function PlayerDetailsDialog({ playerId, open, onOpenChange }: Props) {
  const [loading, setLoading] = React.useState(false)
  const [data, setData] = React.useState<any>(null)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open || !playerId) return
    let abort = new AbortController()
    setLoading(true); setErr(null); setData(null)
    fetch(`/api/scout/players/${playerId}/details`, { signal: abort.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || r.statusText)
        return r.json()
      })
      .then(setData)
      .catch((e) => { if (e.name !== "AbortError") { setErr(e.message); toast.error(e.message) } })
      .finally(() => setLoading(false))
    return () => abort.abort()
  }, [open, playerId])

  const p = data?.player
  const tm = data?.transfermarkt
  const profile = tm?.profile

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{p?.full_name || "Player"}</DialogTitle>
        </DialogHeader>

        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {err && <div className="text-sm text-red-600">Error: {err}</div>}

        {!loading && !err && p && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.image_url || profile?.imageUrl || "/placeholder.svg"}
                alt={p.full_name}
                className="h-24 w-24 rounded-md object-cover border"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {p.main_position && <Badge variant="secondary">{p.main_position}</Badge>}
                  {!!p.current_club_name && <Badge variant="outline">{p.current_club_name}</Badge>}
                  {!!p.current_club_country && <Badge variant="outline">{p.current_club_country}</Badge>}
                  {Array.isArray(profile?.citizenship) && profile.citizenship.map((c: string) => (
                    <Badge key={c} variant="outline">{c}</Badge>
                  ))}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  DoB: {p.date_of_birth ?? "—"} · Height: {p.height_cm ? `${p.height_cm} cm` : "—"} · Foot: {p.dominant_foot ?? profile?.foot ?? "—"}
                </div>
                {!!(p.transfermarkt_url || profile?.url) && (
                  <a
                    className="text-xs underline text-muted-foreground inline-flex items-center gap-1 mt-1"
                    href={profile?.url || p.transfermarkt_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Transfermarkt <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>

            <Separator />

            {/* Club/contract */}
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium mb-1">Club</div>
                <div>Current: {p.current_club_name ?? profile?.club?.name ?? "—"}</div>
                <div>Joined: {profile?.club?.joined ?? "—"}</div>
                <div>Contract: {profile?.club?.contractExpires ?? p.contract_until ?? "—"}</div>
              </div>
              <div>
                <div className="font-medium mb-1">Market</div>
                <div>Value: {tm?.marketValue?.current?.value ?? profile?.marketValue ?? "—"}</div>
                <div>Shirt: {profile?.shirtNumber ?? "—"}</div>
                <div>Agent: {profile?.agent?.name ?? "—"}</div>
              </div>
            </div>

            {/* Stats */}
            {Array.isArray(tm?.stats?.stats) && tm.stats.stats.length > 0 && (
              <div className="text-sm">
                <div className="font-medium mb-1">Stats (snapshot)</div>
                <div className="max-h-40 overflow-auto border rounded-md p-2">
                  {tm.stats.stats.slice(0, 10).map((s: any, i: number) => (
                    <div key={i} className="grid grid-cols-4 gap-2 text-xs py-1 border-b last:border-0">
                      <div className="truncate">{s?.season ?? "—"}</div>
                      <div className="truncate">{s?.competition ?? "—"}</div>
                      <div className="truncate">Apps: {s?.appearances ?? "—"}</div>
                      <div className="truncate">Goals: {s?.goals ?? "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transfers */}
            {Array.isArray(tm?.transfers?.transfers) && tm.transfers.transfers.length > 0 && (
              <div className="text-sm">
                <div className="font-medium mb-1">Transfers</div>
                <div className="space-y-1 max-h-40 overflow-auto">
                  {tm.transfers.transfers.map((t: any, i: number) => (
                    <div key={i} className="text-xs">
                      {t?.date ?? "—"} — {t?.from?.name ?? "?"} ➜ {t?.to?.name ?? "?"} ({t?.fee ?? "—"})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Injuries / Achievements (compact) */}
            {Array.isArray(tm?.injuries?.injuries) && tm.injuries.injuries.length > 0 && (
              <div className="text-sm">
                <div className="font-medium mb-1">Injuries</div>
                <div className="space-y-1 max-h-40 overflow-auto">
                  {tm.injuries.injuries.slice(0, 10).map((n: any, i: number) => (
                    <div key={i} className="text-xs">
                      {n?.season ?? "—"} — {n?.type ?? "—"} ({n?.days ?? "?"} days)
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(tm?.achievements?.achievements) && tm.achievements.achievements.length > 0 && (
              <div className="text-sm">
                <div className="font-medium mb-1">Achievements</div>
                <div className="space-y-1 max-h-40 overflow-auto">
                  {tm.achievements.achievements.slice(0, 10).map((a: any, i: number) => (
                    <div key={i} className="text-xs">
                      {a?.season ?? "—"} — {a?.title ?? "—"}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
