// src/app/api/scout/players/route.ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function normName(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const first = (body.first_name ?? "").trim()
    const last = (body.last_name ?? "").trim()
    const dob = (body.date_of_birth ?? "").trim()
    if (!first || !last || !dob) {
      return NextResponse.json(
        { error: "First name, Last name and Date of birth are required." },
        { status: 400 }
      )
    }

    // NOTE: await cookies() in route handlers on Next 15
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            // Next 15 supports both object and (name,value,options) signatures
            cookieStore.set(name, value, options)
          },
          remove(name: string, options: any) {
            // remove by setting empty value + maxAge 0
            cookieStore.set(name, "", { ...options, maxAge: 0 })
          },
        },
      }
    )

    const { data: { user }, error: uerr } = await supabase.auth.getUser()
    if (uerr) return NextResponse.json({ error: uerr.message }, { status: 401 })
    if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

    const insertObj: any = {
      scout_id: user.id,
      full_name: (body.full_name ?? `${first} ${last}`).trim(),
      full_name_norm: normName(body.full_name ?? `${first} ${last}`),
      date_of_birth: dob,
      height_cm: body.height_cm ?? null,
      weight_kg: body.weight_kg ?? null,
      country_of_birth: body.country_of_birth ?? null,
      has_eu_passport: !!body.has_eu_passport,
      current_club_name: body.current_club_name ?? null,
      current_club_country: body.current_club_country ?? null,
      current_club_tier: body.current_club_tier ?? null,
      main_position: body.main_position ?? null,
      dominant_foot: body.dominant_foot ?? null,
      alt_positions: Array.isArray(body.alt_positions) && body.alt_positions.length ? body.alt_positions : null,
      english_speaks: !!body.english_speaks,
      english_level: body.english_level ?? null,
      contact_phone: body.contact_phone ?? null,
      contact_email: body.contact_email ?? null,
      facebook_url: body.facebook_url ?? null,
      instagram_url: body.instagram_url ?? null,
      transfermarkt_url: body.transfermarkt_url ?? null,
      video_urls: Array.isArray(body.video_urls) && body.video_urls.length ? body.video_urls : null,
      contract_status: body.contract_status ?? null,
      contract_until: body.contract_until ?? null,
      agency: body.agency ?? null,
      coach_contact: body.coach_contact ?? null,
      clubs_last5: body.clubs_last5 ?? null,
      leagues: body.leagues ? body.leagues : null,
      appearances: body.appearances ?? null,
      minutes: body.minutes ?? null,
      national_team_caps: !!body.national_team_caps,
      national_team_minutes: body.national_team_minutes ?? null,
      goals_last_season: body.goals_last_season ?? null,
      assists_last_season: body.assists_last_season ?? null,
      dribbles_last_season: body.dribbles_last_season ?? null,
      injuries_last_3y: body.injuries_last_3y ?? null,
      opinion: body.opinion ?? null,
      image_url: body.image_url ?? null,
      image_path: body.image_path ?? null,
      first_name: first,
      last_name: last,
    }

    if (typeof insertObj.leagues === "string") {
      try { insertObj.leagues = JSON.parse(insertObj.leagues) } catch { insertObj.leagues = null }
    }

    const { data, error } = await supabase
      .from("scout_player_entries")
      .insert(insertObj)
      .select("id")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 })
  }
}
