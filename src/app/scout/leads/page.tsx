'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Calendar,
  Clock,
  User2,
  Shirt,
  Edit3,
  Save,
  X,
  Filter,
  PlusCircle,
  Link2 as LinkIcon,
} from 'lucide-react'

type Row = {
  lead_id: string
  scout_id: string
  status: 'pending'|'linked'|'rejected'
  team_name: string | null
  opponent_name: string | null
  jersey_number: number | null
  match_datetime: string
  canonical_player_id: string | null
  created_at: string
  first_seen_at: string
  last_seen_at: string
  leads_count: number
  scouts_count: number
}

type PlayerLite = {
  id: string
  full_name: string
  main_position: string | null
  current_club_name: string | null
  current_club_country: string | null
  image_url: string | null
  transfermarkt_url: string | null
}

function formatDT(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function sigFor(team: string, dtIso: string, jersey: number | null) {
  try {
    const dt = new Date(dtIso)
    const minuteBucket = Math.floor(dt.getTime() / 1000 / 60)
    const jerseyPart = jersey == null ? '' : String(jersey)
    return `${team.toLowerCase()}|${minuteBucket}|${jerseyPart}`
  } catch {
    return ''
  }
}

export default function ScoutLeadsPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Row[]>([])
  const [playersById, setPlayersById] = useState<Record<string, PlayerLite>>({})
  const [loading, setLoading] = useState(true)

  // filters
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all'|'pending'|'linked'|'rejected'>('all')

  // edit modal state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTeam, setEditTeam] = useState('')
  const [editOpp, setEditOpp] = useState('')
  const [editDate, setEditDate] = useState('')   // yyyy-mm-dd
  const [editTime, setEditTime] = useState('')   // HH:mm
  const [editJersey, setEditJersey] = useState<string>('') // keep as string to allow empty
  const [editNotes, setEditNotes] = useState('')

  async function refresh() {
    setLoading(true)
    const { data, error } = await supabase
      .from('scout_leads_overview')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      setLoading(false)
      toast.error('Failed to load leads', { description: error.message })
      return
    }
    const rows = (data || []) as Row[]
    setRows(rows)
    setLoading(false)

    // fetch linked player info in batch
    const ids = Array.from(new Set(rows.map(r => r.canonical_player_id).filter(Boolean))) as string[]
    if (ids.length) {
      const { data: players, error: perr } = await supabase
        .from('players')
        .select('id, full_name, main_position, current_club_name, current_club_country, image_url, transfermarkt_url')
        .in('id', ids)
      if (!perr && players) {
        const map: Record<string, PlayerLite> = {}
        for (const p of players as PlayerLite[]) map[p.id] = p
        setPlayersById(map)
      }
    } else {
      setPlayersById({})
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter(r => {
      if (status !== 'all' && r.status !== status) return false
      if (!needle) return true
      const hay = [
        r.team_name ?? '',
        r.opponent_name ?? '',
        r.jersey_number ?? '',
        r.match_datetime,
      ].join(' ').toLowerCase()
      return hay.includes(needle)
    })
  }, [rows, q, status])

  const totals = useMemo(() => {
    const total = rows.length
    const linked = rows.filter(r => r.canonical_player_id).length
    const pending = rows.filter(r => r.status === 'pending').length
    const rejected = rows.filter(r => r.status === 'rejected').length
    return { total, linked, pending, rejected }
  }, [rows])

  function openEdit(r: Row) {
    setEditingId(r.lead_id)
    setEditTeam(r.team_name ?? '')
    setEditOpp(r.opponent_name ?? '')
    // split match_datetime
    try {
      const d = new Date(r.match_datetime)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const hh = String(d.getHours()).padStart(2, '0')
      const mi = String(d.getMinutes()).padStart(2, '0')
      setEditDate(`${yyyy}-${mm}-${dd}`)
      setEditTime(`${hh}:${mi}`)
    } catch {
      setEditDate('')
      setEditTime('')
    }
    setEditJersey(r.jersey_number == null ? '' : String(r.jersey_number))
    // get notes from base table
    ;(async () => {
      const { data } = await supabase.from('player_leads').select('notes').eq('id', r.lead_id).single()
      setEditNotes((data?.notes as string) ?? '')
    })()
  }

  async function saveEdit() {
    if (!editingId) return
    if (!editTeam.trim()) return toast.error('Team is required')
    if (!editDate || !editTime) return toast.error('Match date and time are required')
    const iso = new Date(`${editDate}T${editTime}:00`).toISOString()
    const jerseyNum = editJersey.trim() === '' ? null : Number(editJersey)
    const dedupe = sigFor(editTeam, iso, jerseyNum)

    const { error } = await supabase
      .from('player_leads')
      .update({
        team_name: editTeam.trim(),
        opponent_name: editOpp.trim() || null,
        match_datetime: iso,
        jersey_number: jerseyNum,
        notes: editNotes.trim() || null,
        dedupe_sig: dedupe || null,
      })
      .eq('id', editingId)

    if (error) {
      toast.error('Failed to update', { description: error.message })
      return
    }
    toast.success('Lead updated')
    setEditingId(null)
    await refresh()
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header / actions */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My Leads</h1>
          <p className="text-sm text-muted-foreground">
            Manage unidentified-player reports. Linked leads show rich player details.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/scout/leads/new">
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
              New lead
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-xl font-semibold">{totals.total}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Linked</div>
          <div className="text-xl font-semibold">{totals.linked}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Pending</div>
          <div className="text-xl font-semibold">{totals.pending}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Rejected</div>
          <div className="text-xl font-semibold">{totals.rejected}</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {/* All values must be non-empty to avoid radix Select runtime errors */}
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="linked">Linked</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by team, opponent, jersey…"
            className="w-full sm:max-w-sm"
          />
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="text-left font-medium p-3">Player</th>
                <th className="text-left font-medium p-3">Match</th>
                <th className="text-left font-medium p-3">Date &amp; time</th>
                <th className="text-left font-medium p-3">#</th>
                <th className="text-left font-medium p-3">Cluster</th>
                <th className="text-left font-medium p-3">Status</th>
                <th className="text-right font-medium p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">No leads found.</td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const p = r.canonical_player_id ? playersById[r.canonical_player_id] : null
                  return (
                    <tr key={r.lead_id} className="border-b hover:bg-muted/30">
                      {/* Player info cell (primary) */}
                      <td className="p-3">
                        {p ? (
                          <div className="flex items-center gap-3">
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt={p.full_name}
                                className="h-10 w-10 rounded-full object-cover border"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-muted grid place-items-center">
                                <User2 className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-medium truncate">{p.full_name}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {p.main_position || '—'} · {p.current_club_name || '—'}
                                {p.current_club_country ? ` (${p.current_club_country})` : ''}
                              </div>
                              {p.transfermarkt_url && (
                                <a
                                  href={p.transfermarkt_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline mt-0.5"
                                >
                                  <LinkIcon className="h-3 w-3" /> Transfermarkt
                                </a>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-muted-foreground">Not linked</div>
                        )}
                      </td>

                      {/* Match */}
                      <td className="p-3">
                        <div className="font-medium">{r.team_name ?? '—'} <span className="text-muted-foreground">vs</span> {r.opponent_name ?? '—'}</div>
                        <div className="text-[11px] text-muted-foreground">Lead ID: <code className="font-mono">{r.lead_id.slice(0, 8)}…</code></div>
                      </td>

                      {/* Date & time */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{formatDT(r.match_datetime)}</span>
                        </div>
                      </td>

                      {/* Jersey */}
                      <td className="p-3">
                        <div className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5">
                          <Shirt className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="tabular-nums">{r.jersey_number ?? '—'}</span>
                        </div>
                      </td>

                      {/* Cluster */}
                      <td className="p-3">
                        <div className="text-xs text-muted-foreground">
                          Reports: <span className="font-medium text-foreground">{r.leads_count}</span>{" "}
                          · Scouts: <span className="font-medium text-foreground">{r.scouts_count}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-3">
                        {r.status === 'linked' && <Badge className="bg-emerald-600 hover:bg-emerald-600">linked</Badge>}
                        {r.status === 'pending' && <Badge variant="secondary">pending</Badge>}
                        {r.status === 'rejected' && <Badge className="bg-rose-600 hover:bg-rose-600">rejected</Badge>}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                            <Edit3 className="h-4 w-4 mr-1" /> Edit
                          </Button>
                          <Link href="/scout/leads/new">
                            <Button size="sm" variant="ghost">New</Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit modal */}
      {editingId && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditingId(null)} />
          <div className="absolute inset-x-0 top-10 mx-auto w-[min(760px,92vw)] rounded-2xl bg-background border shadow-xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Edit lead</h3>
              <Button variant="ghost" onClick={() => setEditingId(null)}><X className="h-5 w-5" /></Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Team *</Label>
                <Input value={editTeam} onChange={(e) => setEditTeam(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Opponent</Label>
                <Input value={editOpp} onChange={(e) => setEditOpp(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Date *</Label>
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Time *</Label>
                <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Jersey #</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={editJersey}
                  onChange={(e) => setEditJersey(e.target.value)}
                  placeholder="e.g. 10"
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Notes</Label>
                <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Optional…" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setEditingId(null)}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button onClick={saveEdit}>
                <Save className="h-4 w-4 mr-1" /> Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
