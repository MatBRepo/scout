// Player details (scout view)
// - Shows canonical player from public.players
// - Shows interest count (# of scouts following)
// - Shows your observations for that player
// - Shows synced Transfermarkt profile (from tm_players_cache)
// - Follow/Unfollow + Admin "Sync now" buttons

import { createClient } from "@/lib/supabase/server"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Tabs, TabsList, TabsTrigger, TabsContent
} from "@/components/ui/tabs"
import ToggleFollowButton from "./_components/toggle-follow-button"
import AdminSyncButton from "./_components/admin-sync-button"

type PageProps = { params: { id: string } }

export default async function PlayerDetailsPage({ params }: PageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 1) Canonical player
  const { data: player } = await supabase
    .from("players")
    .select(`id, full_name, image_url, transfermarkt_url, transfermarkt_player_id,
             main_position, current_club_name, current_club_country, date_of_birth,
             height_cm, weight_kg, dominant_foot`)
    .eq("id", params.id)
    .maybeSingle()
  if (!player) return notFound()

  // 2) Interest count & my following
  const [{ count: interestCount }, { data: myRel }] = await Promise.all([
    supabase.from("players_scouts")
      .select("scout_id", { count: "exact", head: true })
      .eq("player_id", player.id),
    user
      ? supabase.from("players_scouts")
          .select("player_id")
          .eq("player_id", player.id)
          .eq("scout_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null as any }),
  ])

  // 3) Your observations (lite)
  const { data: myObs } = user
    ? await supabase
        .from("observations")
        .select("id, match_date, competition, opponent, minutes_watched, created_at")
        .eq("player_id", player.id)
        .eq("scout_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] as any[] }

  // 4) Transfermarkt cache (synced JSON)
  const { data: tm } = player.transfermarkt_player_id
    ? await supabase
        .from("tm_players_cache")
        .select("profile, market_value, cached_at")
        .eq("transfermarkt_player_id", player.transfermarkt_player_id)
        .maybeSingle()
    : { data: null as any }

  // 5) admin?
  const { data: meProfile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null as any }
  const isAdmin = meProfile?.role === "admin"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex gap-4 items-start">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border bg-muted">
          {/* using Image is optional; fall back to <img> if needed */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={player.image_url || "/placeholder.svg"}
            alt={player.full_name}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold truncate">{player.full_name}</h1>
            {player.main_position && <Badge variant="secondary">{player.main_position}</Badge>}
            {player.current_club_name && (
              <Badge variant="outline">{player.current_club_name}{player.current_club_country ? ` · ${player.current_club_country}` : ""}</Badge>
            )}
            <Badge variant="outline">Interest: {interestCount ?? 0}</Badge>
          </div>

          <div className="mt-2 text-sm text-muted-foreground space-x-3">
            {player.date_of_birth && <span>DoB: {player.date_of_birth}</span>}
            {player.height_cm && <span>Height: {player.height_cm} cm</span>}
            {player.weight_kg && <span>Weight: {player.weight_kg} kg</span>}
            {player.dominant_foot && <span>Foot: {player.dominant_foot}</span>}
            {player.transfermarkt_url && (
              <>
                <span>·</span>
                <Link className="underline" href={player.transfermarkt_url} target="_blank">Transfermarkt profile</Link>
              </>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <ToggleFollowButton playerId={player.id} initiallyFollowing={!!myRel} />
            {isAdmin && (
              <AdminSyncButton playerId={player.id} />
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transfermarkt">Transfermarkt</TabsTrigger>
          <TabsTrigger value="activity">My Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card className="p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <KV k="Name" v={player.full_name} />
              <KV k="Main position" v={player.main_position || "—"} />
              <KV k="Club" v={player.current_club_name || "—"} />
              <KV k="Country" v={player.current_club_country || "—"} />
              <KV k="Date of birth" v={player.date_of_birth || "—"} />
              <KV k="Height (cm)" v={player.height_cm ?? "—"} />
              <KV k="Weight (kg)" v={player.weight_kg ?? "—"} />
              <KV k="Dominant foot" v={player.dominant_foot || "—"} />
              <KV k="Transfermarkt" v={player.transfermarkt_url ? <Link href={player.transfermarkt_url} className="underline" target="_blank">Open</Link> : "—"} />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="transfermarkt" className="space-y-4">
          <Card className="p-4">
            {!tm?.profile && (
              <div className="text-sm text-muted-foreground">No synced Transfermarkt profile yet.</div>
            )}
            {tm?.profile && (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Cached at: {new Date(tm.cached_at).toLocaleString()}
                </div>

                {/* Example mapped snippets from the JSON; adjust as you like */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <KV k="Nationality" v={tm.profile?.nationality || tm.profile?.citizenship || "—"} />
                  <KV k="Position" v={tm.profile?.position || tm.profile?.mainPosition || "—"} />
                  <KV k="Height" v={tm.profile?.height || "—"} />
                  <KV k="Foot" v={tm.profile?.foot || "—"} />
                  <KV k="Current club" v={tm.profile?.club?.name || tm.profile?.currentClub?.name || "—"} />
                  <KV k="Market value" v={tm.market_value?.currentValue || tm.profile?.marketValue || "—"} />
                </div>

                {/* Optional: list of past clubs if present */}
                {Array.isArray(tm.profile?.pastClubs) && tm.profile.pastClubs.length > 0 && (
                  <div className="mt-2">
                    <div className="font-medium mb-2">Past clubs</div>
                    <ul className="list-disc pl-5 text-sm">
                      {tm.profile.pastClubs.map((c: any, i: number) => (
                        <li key={i}>
                          {c?.name || c?.club} {c?.from && c?.to ? `(${c.from}–${c.to})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card className="p-4">
            <div className="font-medium mb-2">My Observations</div>
            {!myObs?.length && (
              <div className="text-sm text-muted-foreground">You have no observations yet for this player.</div>
            )}
            {!!myObs?.length && (
              <ul className="divide-y">
                {myObs.map((o) => (
                  <li key={o.id} className="py-2 text-sm flex items-center justify-between">
                    <span>
                      {o.match_date} — {o.competition || "—"} vs {o.opponent || "—"} &middot; {o.minutes_watched ?? 0}’
                    </span>
                    <Link className="underline" href={`/scout/observations/${o.id}`}>Open</Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <Link href={`/scout/observations/new?player_id=${player.id}`}>
                <Button size="sm">Add observation</Button>
              </Link>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="text-sm">
      <div className="text-muted-foreground">{k}</div>
      <div className="font-medium break-words">{v ?? "—"}</div>
    </div>
  )
}
