/* eslint-disable @typescript-eslint/no-explicit-any */
import * as cheerio from "cheerio"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const BASE = "https://www.transfermarkt.com"

// --- helpers ---
function ensurePath(p?: string | null) {
  if (!p) return "/";
  if (p.startsWith("http")) return p;   // full URL
  return p.startsWith("/") ? p : `/${p.replace(/^(\.\/)+/, "")}`;
}

async function fetchHtml(pathOrUrl: string, referer?: string) {
  const isAbs = /^https?:\/\//i.test(pathOrUrl);
  const url = isAbs ? pathOrUrl : `${BASE}${ensurePath(pathOrUrl)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      ...(referer ? { "Referer": referer } : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${url}${txt ? ` — ${txt.slice(0, 160)}…` : ""}`);
  }
  return res.text();
}


function parseEuroToInt(s?: string | null) {
  if (!s) return null
  const raw = s.replace(/[€\s]/g, "").toLowerCase()
  if (!raw || raw === "-") return null
  let mult = 1, num = raw
  if (raw.endsWith("m")) { mult = 1_000_000; num = raw.slice(0, -1) }
  else if (raw.endsWith("k")) { mult = 1_000; num = raw.slice(0, -1) }
  const f = parseFloat(num.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(f) ? Math.round(f * mult) : null
}
function parseIntLoose(s?: string | null) {
  if (!s) return null
  const n = parseInt(s.replace(/[^\d]/g, ""), 10)
  return Number.isFinite(n) ? n : null
}
function parseFloatEU(s?: string | null) {
  if (!s) return null
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}
function parseCompetitionsDetailed(html: string, countryId: string, seasonId: number) {
  const $ = cheerio.load(html)
  const rows: any[] = []
  let tier: string | null = null

  $("table.items > tbody > tr").each((_, tr) => {
    const $tr = $(tr)
    if ($tr.find("td.extrarow").length) {
      tier = $tr.text().trim().replace(/\s+/g, " ")
      return
    }
    const tds = $tr.find("> td")
    if (tds.length < 8) return

    const $nameCell = $(tds[0])
    const $inline = $nameCell.find("table.inline-table td").eq(1)
    const $a = $inline.find("a").first()
    const name = $a.text().trim()
    const profile_path = $a.attr("href") || ""
    const m = profile_path.match(/\/wettbewerb\/([^/?#]+)/i)
    const code = m ? m[1] : null

    if (!code || !name) return

    const clubs_count = parseIntLoose($(tds[1]).text().trim())
    const players_count = parseIntLoose($(tds[2]).text().trim())
    const avg_age = parseFloatEU($(tds[3]).text().trim())
    // foreigners cell is like "23.9 %"
    const foreigners_pct = parseFloat(($(tds[4]).text().trim().replace("%","")).replace(",", ".")) || null
    const goals_per_match = parseFloatEU($(tds[5]).text().trim())
    const forum_path = $(tds[6]).find("a").attr("href") || null
    const total_value_eur = parseEuroToInt($(tds[7]).text().trim())

    rows.push({
      country_id: countryId,
      season_id: seasonId,
      tier_label: tier,
      code,
      name,
      profile_path,
      clubs_count,
      players_count,
      avg_age,
      foreigners_pct,
      goals_per_match,
      forum_path,
      total_value_eur,
    })
  })

  return rows
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const country = searchParams.get("country")
    const seasonStr = searchParams.get("season")

    if (!country || !seasonStr) {
      return new Response(JSON.stringify({ error: "Missing ?country= and/or ?season=" }), { status: 400 })
    }
    const season = parseInt(seasonStr, 10)
    if (!Number.isFinite(season)) {
      return new Response(JSON.stringify({ error: "Invalid season" }), { status: 400 })
    }

    // detailed competitions table (includes season stats)
    const url = `${BASE}/wettbewerbe/national/wettbewerbe/${encodeURIComponent(country)}/saison_id/${season}/plus/1`
    const html = await fetchHtml(url)
    const competitions = parseCompetitionsDetailed(html, country, season)

    return new Response(JSON.stringify({ competitions }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Failed" }), { status: 500 })
  }
}
