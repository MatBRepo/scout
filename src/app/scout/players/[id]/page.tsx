// src/app/scout/players/[id]/page.tsx
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Client from "./Client"

export const dynamic = "force-dynamic"

export default async function PlayerProfilePage(
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirect_to=/scout/players/${id}`)
  }

  // Player core
  const {
    data: player,
    error: playerError,
  } = await supabase
    .from("players")
    .select(`
      id, full_name, first_name, last_name,
      date_of_birth, height_cm, weight_kg, dominant_foot, main_position, alt_positions,
      english_level, english_speaks,
      country_of_birth, has_eu_passport,
      current_club_name, current_club_country, current_club_tier,
      appearances, minutes, national_team_caps, national_team_minutes,
      goals_last_season, assists_last_season, dribbles_last_season,
      contract_status, contract_until, agency,
      contact_phone, contact_email, facebook_url, instagram_url, coach_contact,
      transfermarkt_url, transfermarkt_player_id,
      video_urls, injuries_last_3y,
      image_url, image_path
    `)
    .eq("id", id)
    .maybeSingle()

  if (playerError) throw playerError
  if (!player) notFound()

  // Observations (only current scout)
  const { data: observations } = await supabase
    .from("observations")
    .select(
      "id, match_date, competition, opponent, minutes_watched, notes, created_at"
    )
    .eq("player_id", id)
    .eq("scout_id", user.id)
    .order("match_date", { ascending: false })

  // Notes for this scout
  const { data: notes } = await supabase
    .from("scout_notes")
    .select("id, category, rating, comment, created_at, updated_at")
    .eq("player_id", id)
    .eq("scout_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <div className="">
      <Client
        userId={user.id}
        player={player}
        observations={observations ?? []}
        notes={notes ?? []}
      />
    </div>
  )
}
