// src/app/api/tm/search/route.ts
import { NextResponse } from "next/server"

const TM_API_BASE =
  process.env.TRANSFERMARKT_API_URL?.replace(/\/+$/, "") || "http://localhost:8000"
const TM_TIMEOUT_MS = Number(process.env.TM_API_TIMEOUT_MS || 12000)

function withTimeout<T>(p: Promise<T>, ms = TM_TIMEOUT_MS) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Transfermarkt API timeout")), ms)
    p.then((v) => { clearTimeout(t); resolve(v) })
     .catch((e) => { clearTimeout(t); reject(e) })
  })
}

async function tmFetch(url: string) {
  const res = await withTimeout(fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  }))
  if (!res.ok) {
    let msg = res.statusText
    try { msg = (await res.json())?.detail || msg } catch {}
    throw new Error(`TM API ${res.status}: ${msg}`)
  }
  return res.json()
}

/**
 * GET /api/tm/search?q=<surname>&page=<n>&first=<optional first name>
 * Proxies to: GET {TM_API_BASE}/players/search/{surname}?page_number=<n>
 * Optionally filters results by first name on the server (best-effort).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const surname = (searchParams.get("q") || "").trim()
  const page = Number(searchParams.get("page") || "1")
  const firstName = (searchParams.get("first") || "").trim().toLowerCase()

  if (!surname || surname.length < 2) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 })
  }

  const url = `${TM_API_BASE}/players/search/${encodeURIComponent(surname)}?page_number=${isFinite(page) && page > 0 ? page : 1}`

  try {
    const raw = await tmFetch(url)

    // Your API might return {items:[...]} or [...] — normalize
    const arr = Array.isArray(raw) ? raw : (raw?.items || [])
    // Map to a compact, predictable shape
    const items = arr.map((r: any) => ({
      tm_id: r?.id || r?.tm_id || r?.transfermarkt_player_id || null,
      name: r?.name || r?.full_name || r?.player_name || [r?.first_name, r?.last_name].filter(Boolean).join(" ") || null,
      first_name: r?.first_name || null,
      last_name: r?.last_name || null,
      date_of_birth: r?.date_of_birth || r?.dob || null,
      current_club_name: r?.current_club_name || r?.club || null,
      position_main: r?.main_position || r?.position || null,
      height_cm: r?.height_cm ?? (r?.height ? Number(String(r.height).replace(/\D/g, "")) : null),
      dominant_foot: r?.foot || r?.dominant_foot || null,
      nationality: r?.nationality || r?.citizenship || null,
      profile_url: r?.profile_url || r?.url || null,
      image_url: r?.image_url || r?.photo || null,
    }))
    .filter((x: any) => x.tm_id && x.name)

    // Optional filter by first name (best-effort, case-insensitive “starts with”)
    const filtered = firstName
      ? items.filter(it => (it.first_name || it.name).toLowerCase().startsWith(firstName))
      : items

    return NextResponse.json({ items: filtered })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "TM search failed", base: TM_API_BASE },
      { status: e?.message?.includes("timeout") ? 504 : 502 }
    )
  }
}
