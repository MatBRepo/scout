// app/admin/scraper/page.tsx
"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import {
  Play,
  Square,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Database,
  Copy,
  Check,
  Search,
  ExternalLink,
} from "lucide-react"

/* ---------- types ---------- */
type Competition = {
  country_id: string
  season_id?: number | null
  code: string
  name: string
  profile_path?: string
  path?: string
  url_path?: string
  href?: string
  tier_label?: string | null
  clubs_count?: number | null
  players_count?: number | null
}

type RowState = {
  status: "idle" | "running" | "done" | "error"
  progress: number // 0..100
  message?: string
  counts?: { clubs?: number; players?: number }
}

type SsePayload = {
  phase?: "init" | "fetch" | "parse" | "save" | "done" | "error"
  message?: string
  progress?: number // 0..1
  counts?: { clubs?: number; players?: number }
  done?: boolean
  error?: string
}

/* ---------- helpers ---------- */
function getTmPath(c: Competition): string | null {
  return c.profile_path || c.path || c.url_path || c.href || null
}

function badge(text: string) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-none text-muted-foreground">
      {text}
    </span>
  )
}

/* ---------- page ---------- */
export default function ScraperPage() {
  const [country, setCountry] = useState("135")
  const [season, setSeason] = useState("2025")

  const [items, setItems] = useState<Competition[]>([])
  const [loadingList, setLoadingList] = useState(false)

  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [running, setRunning] = useState(false)
  const stopFlag = useRef(false)
  const currentEs = useRef<EventSource | null>(null)

  const [search, setSearch] = useState("")

  /* ----- load competitions ----- */
  const loadCompetitions = async () => {
    setLoadingList(true)
    try {
      const url = `/api/admin/tm/scrape/competition/list?country=${encodeURIComponent(
        country
      )}&season=${encodeURIComponent(season)}`
      const r = await fetch(url, { cache: "no-store" })
      if (!r.ok) {
        const t = await r.text().catch(() => "")
        throw new Error(t || `HTTP ${r.status}`)
      }
      const j = await r.json()
      const list: Competition[] = j.competitions || []
      setItems(list)

      // initialize row states
      const init: Record<string, RowState> = {}
      for (const c of list) init[c.code] = { status: "idle", progress: 0 }
      setRows(init)
      setSelected(new Set())
    } catch (e: any) {
      toast.error(e?.message || "Failed to load competitions")
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    loadCompetitions()
    return () => {
      currentEs.current?.close()
      currentEs.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ----- selection helpers ----- */
  const toggleOne = (code: string) => {
    if (running) return
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(code)) n.delete(code)
      else n.add(code)
      return n
    })
  }
  // Select all items (ignores filter)
  const selectAll = () => !running && setSelected(new Set(items.map(i => i.code)))
  // Select only currently visible (filtered) items
  const selectVisible = (visibleCodes: string[]) =>
    !running && setSelected(new Set(visibleCodes))
  const clearSel = () => !running && setSelected(new Set())

  /* ----- filtering ----- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((c) => {
      const path = getTmPath(c) || ""
      return (
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.tier_label || "").toLowerCase().includes(q) ||
        path.toLowerCase().includes(q)
      )
    })
  }, [items, search])

  /* ----- overall progress across *all selected* ----- */
  const overall = useMemo(() => {
    if (!selected.size) return 0
    const vals: number[] = []
    for (const code of selected) vals.push(rows[code]?.progress ?? 0)
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }, [selected, rows])

  /* ----- HEAD preflight for SSE ----- */
  async function preflightStream(tmPath: string) {
    const url = `/api/admin/tm/scrape/stream?path=${encodeURIComponent(tmPath)}&season=${encodeURIComponent(season)}`
    try {
      const res = await fetch(url, { method: "HEAD", cache: "no-store" })
      return { ok: res.ok, status: res.status }
    } catch {
      return { ok: false, status: 0 }
    }
  }

  /* ----- run ONE competition (SSE) ----- */
  const runOneCompetition = (comp: Competition) =>
    new Promise<void>(async (resolve) => {
      const code = comp.code
      const tmPath = getTmPath(comp)

      if (!tmPath) {
        setRows(s => ({
          ...s,
          [code]: {
            status: "error",
            progress: 100,
            message: "Missing profile path for this competition",
          },
        }))
        return resolve()
      }

      setRows((s) => ({
        ...s,
        [code]: {
          ...(s[code] || { status: "idle", progress: 0 }),
          status: "running",
          message: "Starting…",
        },
      }))

      // Preflight first
      const pre = await preflightStream(tmPath)
      if (!pre.ok) {
        setRows((s) => ({
          ...s,
          [code]: {
            status: "error",
            progress: 100,
            message:
              pre.status === 404
                ? "SSE route not found (404). Check app/api/admin/tm/scrape/stream/route.ts"
                : `Stream preflight failed (HTTP ${pre.status || 0})`,
          },
        }))
        return resolve()
      }

      const url = `/api/admin/tm/scrape/stream?path=${encodeURIComponent(tmPath)}&season=${encodeURIComponent(season)}`
      const es = new EventSource(url)
      currentEs.current = es

      es.onopen = () => {
        setRows((s) => ({
          ...s,
          [code]: {
            ...(s[code] || { status: "running", progress: 0 }),
            status: "running",
            message: "Connected…",
          },
        }))
      }

      es.onmessage = (evt) => {
        try {
          const data: SsePayload = evt.data ? JSON.parse(evt.data) : {}
          const pct = Math.max(0, Math.min(100, Math.round((data.progress ?? 0) * 100)))

          if (data.phase === "error") {
            setRows((s) => ({
              ...s,
              [code]: {
                status: "error",
                progress: 100,
                message: data.message || data.error || "Error",
                counts: data.counts,
              },
            }))
          } else if (data.phase === "done") {
            setRows((s) => ({
              ...s,
              [code]: {
                status: "done",
                progress: 100,
                message: data.message || "Finished",
                counts: data.counts,
              },
            }))
          } else {
            setRows((s) => ({
              ...s,
              [code]: {
                ...(s[code] || { status: "idle", progress: 0 }),
                status: "running",
                progress: pct,
                message: data.message,
                counts: data.counts,
              },
            }))
          }

          if (data.done) {
            es.close()
            if (currentEs.current === es) currentEs.current = null
            resolve()
          }
        } catch {
          // ignore malformed chunk
        }
      }

      es.onerror = async () => {
        try {
          const probe = await fetch(url, { method: "HEAD" })
          setRows((s) => ({
            ...s,
            [code]: {
              status: "error",
              progress: 100,
              message: `Stream error (HTTP ${probe.status})`,
            },
          }))
        } catch {
          setRows((s) => ({
            ...s,
            [code]: { status: "error", progress: 100, message: "Stream error" },
          }))
        }
        es.close()
        if (currentEs.current === es) currentEs.current = null
        resolve()
      }
    })

  /* ----- run selected (sequential queue) ----- */
  const runQueue = async () => {
    if (!selected.size) {
      toast.message("Pick at least one competition")
      return
    }
    setRunning(true)
    stopFlag.current = false

    // run in a stable order (by name) for predictability
    const order = items
      .filter((i) => selected.has(i.code))
      .sort((a, b) => a.name.localeCompare(b.name))

    for (const comp of order) {
      if (stopFlag.current) break
      try {
        await runOneCompetition(comp)
      } catch (e) {
        console.error("Run failed for", comp.code, e)
      }
    }

    setRunning(false)
    currentEs.current?.close()
    currentEs.current = null
  }

  /* ----- run only one competition ----- */
  const runSingle = async (comp: Competition) => {
    if (running) return
    setSelected(new Set([comp.code]))
    setRunning(true)
    stopFlag.current = false
    try {
      await runOneCompetition(comp)
    } finally {
      setRunning(false)
      currentEs.current?.close()
      currentEs.current = null
    }
  }

  /* ----- stop ----- */
  const stop = () => {
    stopFlag.current = true
    currentEs.current?.close()
    currentEs.current = null
    setRunning(false)
  }

  /* ----- copy path ----- */
  const copyPath = async (path?: string | null) => {
    if (!path) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(path)
      } else {
        // fallback
        const ta = document.createElement("textarea")
        ta.value = path
        document.body.appendChild(ta)
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
      }
      toast.success("Path copied")
    } catch {
      toast.error("Copy failed")
    }
  }

  /* ---------- UI ---------- */
  const total = items.length
  const visible = filtered.length
  const selCount = selected.size
  const visibleCodes = filtered.map((c) => c.code)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <Database className="h-5 w-5" />
          Clubs–Players Scraper
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center rounded-full border px-2 py-0.5">Loaded: {total}</span>
          <span className="inline-flex items-center rounded-full border px-2 py-0.5">Visible: {visible}</span>
          <span className="inline-flex items-center rounded-full border px-2 py-0.5">Selected: {selCount}</span>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/scraper/data">Scraped data</Link>
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={loadCompetitions}
            disabled={loadingList || running}
          >
            <RotateCw className="h-4 w-4" />
            Refresh list
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm">Country</label>
            <Input
              className="w-28"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              onBlur={loadCompetitions}
              disabled={running}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">Season</label>
            <Input
              className="w-28"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              onBlur={loadCompetitions}
              disabled={running}
            />
          </div>

          <div className="flex items-center gap-2 ml-auto w-full sm:w-auto">
            <div className="relative w-full sm:w-[260px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name / code / path…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={running && !!selCount}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setSearch("")}
              disabled={!search || (running && !!selCount)}
            >
              Clear
            </Button>
          </div>

          <div className="w-full border-t my-1" />

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={selectAll}
              disabled={!items.length || running}
              title="Select every competition in the list"
            >
              Select all
            </Button>
            <Button
              variant="outline"
              onClick={() => selectVisible(visibleCodes)}
              disabled={!filtered.length || running}
              title="Select only the currently visible items"
            >
              Select visible
            </Button>
            <Button
              variant="outline"
              onClick={clearSel}
              disabled={(!items.length && !selCount) || running}
            >
              Clear
            </Button>
          </div>

          <div className="ml-auto flex gap-2">
            {running ? (
              <Button variant="destructive" className="gap-2" onClick={stop}>
                <Square className="h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button
                className="gap-2"
                onClick={runQueue}
                disabled={!selCount}
              >
                <Play className="h-4 w-4" />
                Start
              </Button>
            )}
          </div>
        </div>

        <div className="mt-2">
          <div className="text-sm mb-2">Overall progress: {overall}%</div>
          <Progress value={overall} />
        </div>
      </Card>

      {/* List */}
      <div className="grid gap-3">
        {filtered.map((c) => {
          const st = rows[c.code] || ({ status: "idle", progress: 0 } as RowState)
          const disabled = running
          const tmPath = getTmPath(c)
          const isSelected = selected.has(c.code)
          const tmHref = tmPath ? `https://www.transfermarkt.com${tmPath}` : null

          return (
            <Card key={c.code} className="p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* Left: checkbox + name + badges */}
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-foreground"
                    checked={isSelected}
                    onChange={() => toggleOne(c.code)}
                    disabled={disabled}
                    aria-label={`Select ${c.name}`}
                  />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                      {badge(c.tier_label || "—")}
                      {typeof c.clubs_count === "number" && badge(`${c.clubs_count} clubs`)}
                      {typeof c.players_count === "number" && badge(`${c.players_count} players`)}

                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground truncate max-w-[280px]">
                        {tmPath || "—"}
                        {tmPath && (
                          <>
                            <button
                              className="ml-1 inline-flex items-center rounded border px-1 py-0.5 hover:bg-muted"
                              onClick={() => copyPath(tmPath)}
                              title="Copy path"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                            <a
                              href={tmHref!}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-1 inline-flex items-center rounded border px-1 py-0.5 hover:bg-muted"
                              title="Open on Transfermarkt"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Middle: progress */}
                <div className="sm:ml-auto w-full max-w-[520px]">
                  <Progress value={st.progress} />
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate">
                      {st.status === "running" && badge("Running")}
                      {st.status === "done" && (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" /> Done
                        </span>
                      )}
                      {st.status === "error" && (
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <AlertTriangle className="h-4 w-4" /> Error
                        </span>
                      )}
                      <span className="ml-2">{st.message || "—"}</span>
                      {st.counts ? (
                        <span className="ml-2 text-muted-foreground">
                          · {st.counts.clubs ?? 0} clubs / {st.counts.players ?? 0} players
                        </span>
                      ) : null}
                    </span>
                    <span>{st.progress}%</span>
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => runSingle(c)}
                    disabled={running || !tmPath}
                    title={!tmPath ? "No path available for this competition" : "Run only this competition"}
                  >
                    <Play className="h-4 w-4" />
                    Run
                  </Button>
                  <div className="w-6 grid place-items-center">
                    {st.status === "done" && <Check className="h-5 w-5 text-emerald-600" />}
                    {st.status === "error" && <AlertTriangle className="h-5 w-5 text-red-600" />}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
        {!filtered.length && (
          <Card className="p-4 text-sm text-muted-foreground">
            No competitions match your search.
          </Card>
        )}
      </div>
    </div>
  )
}
