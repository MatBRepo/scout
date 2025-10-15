'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import { toast } from 'sonner'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Filter,
  Shirt,
  Calendar,
  ChevronDown,
  ChevronRight,
  Link2 as LinkIcon,
  Unlink,
  Search,
  PlusCircle,
} from 'lucide-react'

type LeadRow = {
  lead_id: string
  dedupe_sig: string
  status: 'linked' | 'pending' | 'rejected'
  team_name: string | null
  opponent_name: string | null
  jersey_number: number | null
  match_datetime: string
  canonical_player_id: string | null
  first_seen_at: string
  last_seen_at: string
  leads_count: number
  scouts_count: number
  scout_ids: string[]
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

type LeadDetail = {
  id: string
  scout_id: string
  created_at: string
  notes: string | null
  status: 'linked' | 'pending' | 'rejected'
}

function fmtDT(iso: string) {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

export default function AdminLeadsPage() {
  const supabase = createClient()

  const [rows, setRows] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)

  // batch cache for linked players (by id)
  const [playersById, setPlayersById] = useState<Record<string, PlayerLite>>({})

  // filters
  const [status, setStatus] = useState<'all'|'linked'|'pending'|'rejected'>('all')
  const [q, setQ] = useState('')

  // row expansion (cluster details)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [details, setDetails] = useState<Record<string, LeadDetail[]>>({})
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({})

  // link dialog state
  const [linkOpenFor, setLinkOpenFor] = useState<string | null>(null) // dedupe_sig
  const [searchQ, setSearchQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<PlayerLite[]>([])
  const [linkingSig, setLinkingSig] = useState<string | null>(null)

  // inline Create & Link form state (per open group)
  const [createBusy, setCreateBusy] = useState(false)
  const [createFullName, setCreateFullName] = useState('')
  const [createDob, setCreateDob] = useState('') // yyyy-mm-dd (required by schema)
  const [createMainPos, setCreateMainPos] = useState('')
  const [createClub, setCreateClub] = useState('')
  const [createClubCountry, setCreateClubCountry] = useState('')
  const [createTmUrl, setCreateTmUrl] = useState('')

  // stats
  const totals = useMemo(() => {
    const total = rows.length
    const linked = rows.filter(r => r.status === 'linked').length
    const pending = rows.filter(r => r.status === 'pending').length
    const rejected = rows.filter(r => r.status === 'rejected').length
    return { total, linked, pending, rejected }
  }, [rows])

  // load grouped leads
  async function refresh() {
    setLoading(true)
    const { data, error } = await supabase
      .from('admin_leads_grouped')
      .select('*')
      .order('last_seen_at', { ascending: false })
    if (error) {
      toast.error('Failed to load leads', { description: error.message })
      setLoading(false)
      return
    }
    const rows = (data || []) as LeadRow[]
    setRows(rows)
    setLoading(false)

    // batch fetch linked player cards
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

  // filter rows
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
        r.dedupe_sig,
      ].join(' ').toLowerCase()
      return hay.includes(needle)
    })
  }, [rows, status, q])

  // expand: fetch cluster details once
  async function toggleExpand(sig: string) {
    setExpanded(prev => ({ ...prev, [sig]: !prev[sig] }))
    const isOpen = expanded[sig]
    if (isOpen) return
    if (details[sig]) return
    setLoadingDetails(prev => ({ ...prev, [sig]: true }))
    const { data, error } = await supabase
      .from('player_leads')
      .select('id, scout_id, created_at, notes, status')
      .eq('dedupe_sig', sig)
      .order('created_at', { ascending: false })
    setLoadingDetails(prev => ({ ...prev, [sig]: false }))
    if (error) {
      toast.error('Failed to load cluster details', { description: error.message })
      return
    }
    setDetails(prev => ({ ...prev, [sig]: (data || []) as any }))
  }

  // change status for the entire cluster
  async function updateClusterStatus(sig: string, newStatus: 'pending'|'rejected') {
    const { error } = await supabase
      .from('player_leads')
      .update({ status: newStatus })
      .eq('dedupe_sig', sig)
    if (error) {
      toast.error('Failed to update status', { description: error.message })
      return
    }
    toast.success(`Status set to ${newStatus}`)
    setRows(prev => prev.map(r => r.dedupe_sig === sig ? { ...r, status: newStatus } : r))
  }

  // search players to link
  async function searchPlayers(q: string) {
    setSearchQ(q)
    if (!q || q.trim().length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    const { data, error } = await supabase
      .from('players')
      .select('id, full_name, main_position, current_club_name, current_club_country, image_url, transfermarkt_url')
      .ilike('full_name', `%${q}%`)
      .limit(20)
    setSearching(false)
    if (error) return
    setSearchResults((data || []) as any)
  }

  async function linkSigToPlayer(sig: string, leadId: string, playerId: string) {
    setLinkingSig(sig)
    try {
      // preferred RPC (links group in your setup)
      const { error: rpcErr } = await supabase.rpc('admin_link_lead_to_player', {
        p_lead_id: leadId,
        p_player_id: playerId,
      })
      if (rpcErr) throw rpcErr

      toast.success('Lead group linked to player')

      // update local list
      setRows(prev => prev.map(r =>
        r.dedupe_sig === sig ? { ...r, canonical_player_id: playerId, status: 'linked' } : r
      ))

      // ensure cache has player card
      if (!playersById[playerId]) {
        const { data: p } = await supabase
          .from('players')
          .select('id, full_name, main_position, current_club_name, current_club_country, image_url, transfermarkt_url')
          .eq('id', playerId)
          .single()
        if (p) setPlayersById(prev => ({ ...prev, [p.id]: p as PlayerLite }))
      }

      // reset link panel state
      setLinkOpenFor(null)
      setSearchQ('')
      setSearchResults([])
    } catch (e: any) {
      toast.error(e.message || 'Failed to link')
    } finally {
      setLinkingSig(null)
    }
  }

  async function unlinkSig(sig: string) {
    const { error } = await supabase
      .from('player_leads')
      .update({ canonical_player_id: null, status: 'pending' })
      .eq('dedupe_sig', sig)
    if (error) {
      toast.error('Failed to unlink', { description: error.message })
      return
    }
    toast.success('Unlinked from player')
    setRows(prev => prev.map(r =>
      r.dedupe_sig === sig ? { ...r, canonical_player_id: null, status: 'pending' } : r
    ))
  }

  // --- Inline Create & Link (no redirect) ---
  function resetCreateForm() {
    setCreateFullName('')
    setCreateDob('')
    setCreateMainPos('')
    setCreateClub('')
    setCreateClubCountry('')
    setCreateTmUrl('')
  }

  async function createAndLink(sig: string, sampleLeadId: string) {
    if (!createFullName.trim()) return toast.error('Full name is required.')
    if (!createDob) return toast.error('Date of birth is required (players.date_of_birth is NOT NULL).')

    setCreateBusy(true)
    try {
      // 1) create player (minimal fields that satisfy your schema)
      const { data: { user } } = await supabase.auth.getUser()
      const { data: ins, error: insErr } = await supabase
        .from('players')
        .insert({
          full_name: createFullName.trim(),
          date_of_birth: createDob,
          main_position: createMainPos || null,
          current_club_name: createClub || null,
          current_club_country: createClubCountry || null,
          transfermarkt_url: createTmUrl || null,
          created_by: user?.id || null,
        })
        .select('id, full_name, main_position, current_club_name, current_club_country, image_url, transfermarkt_url')
        .single()
      if (insErr) throw insErr
      const newPlayer = ins as PlayerLite

      // 2) link the cluster to this player (RPC or bulk update)
      const { error: rpcErr } = await supabase.rpc('admin_link_lead_to_player', {
        p_lead_id: sampleLeadId,
        p_player_id: newPlayer.id,
      })
      if (rpcErr) throw rpcErr

      // 3) update UI
      setRows(prev => prev.map(r =>
        r.dedupe_sig === sig ? { ...r, canonical_player_id: newPlayer.id, status: 'linked' } : r
      ))
      setPlayersById(prev => ({ ...prev, [newPlayer.id]: newPlayer }))
      toast.success('Player created & linked')

      // close link panel
      setLinkOpenFor(null)
      resetCreateForm()
    } catch (e: any) {
      toast.error(e.message || 'Failed to create & link player')
    } finally {
      setCreateBusy(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header & actions */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Admin · Grouped Leads</h1>
          <p className="text-sm text-muted-foreground">
            Dedupe clusters across scouts, link to canonical players, and manage statuses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Keep this for full player creation flow; opens in a new tab */}
          <Link href="/scout/players/new" target="_blank">
            <Button variant="secondary">
              <PlusCircle className="h-4 w-4 mr-2" />
              Create player
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
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
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="linked">Linked</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search team, opponent, date, signature…"
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="text-left font-medium p-3">Group</th>
                <th className="text-left font-medium p-3">Date &amp; time</th>
                <th className="text-left font-medium p-3">Reports</th>
                <th className="text-left font-medium p-3">Linked player</th>
                <th className="text-left font-medium p-3">Status</th>
                <th className="text-right font-medium p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No groups found.</td></tr>
              ) : (
                filtered.map((r) => {
                  const isOpen = !!expanded[r.dedupe_sig]
                  const p = r.canonical_player_id ? playersById[r.canonical_player_id] : null
                  return (
                    <>
                      <tr key={r.lead_id} className="border-b hover:bg-muted/30">
                        {/* Group info */}
                        <td className="p-3">
                          <button
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted"
                            onClick={() => toggleExpand(r.dedupe_sig)}
                            title="Toggle details"
                          >
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <span className="font-medium">{r.team_name ?? '—'}</span>
                            <span className="text-muted-foreground">vs</span>
                            <span className="font-medium">{r.opponent_name ?? '—'}</span>
                          </button>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            <span className="inline-flex items-center gap-1">
                              <Shirt className="h-3.5 w-3.5" />
                              #{r.jersey_number ?? '—'}
                            </span>
                            <span className="mx-2">•</span>
                            sig: <code className="font-mono">{r.dedupe_sig}</code>
                          </div>
                        </td>

                        {/* Date & time */}
                        <td className="p-3">
                          <div className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{fmtDT(r.match_datetime)}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            First: {fmtDT(r.first_seen_at)} · Last: {fmtDT(r.last_seen_at)}
                          </div>
                        </td>

                        {/* Reports */}
                        <td className="p-3">
                          <div className="text-xs text-muted-foreground">
                            Reports: <span className="font-medium text-foreground">{r.leads_count}</span>{' '}
                            · Scouts: <span className="font-medium text-foreground">{r.scouts_count}</span>
                          </div>
                          {!!r.scout_ids?.length && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              scout_ids: {r.scout_ids.slice(0, 4).join(', ')}{r.scout_ids.length > 4 ? '…' : ''}
                            </div>
                          )}
                        </td>

                        {/* Linked player */}
                        <td className="p-3">
                          {p ? (
                            <div className="flex items-center gap-3">
                              {p.image_url ? (
                                <img src={p.image_url} alt={p.full_name} className="h-10 w-10 rounded-full object-cover border" />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-muted border" />
                              )}
                              <div className="min-w-0">
                                <div className="font-medium truncate">{p.full_name}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {p.main_position || '—'} · {p.current_club_name || '—'}
                                  {p.current_club_country ? ` (${p.current_club_country})` : ''}
                                </div>
                                {p.transfermarkt_url && (
                                  <a className="text-xs text-muted-foreground underline inline-flex items-center gap-1 mt-0.5" href={p.transfermarkt_url} target="_blank" rel="noreferrer">
                                    <LinkIcon className="h-3 w-3" /> Transfermarkt
                                  </a>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not linked</span>
                          )}
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
                            {r.status !== 'linked' ? (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setLinkOpenFor(r.dedupe_sig)
                                  setSearchQ(''); setSearchResults([])
                                  resetCreateForm()
                                }}
                              >
                                <LinkIcon className="h-4 w-4 mr-1" /> Link
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => unlinkSig(r.dedupe_sig)}>
                                <Unlink className="h-4 w-4 mr-1" /> Unlink
                              </Button>
                            )}
                            {r.status !== 'linked' && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => updateClusterStatus(r.dedupe_sig, 'pending')}>
                                  Mark pending
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => updateClusterStatus(r.dedupe_sig, 'rejected')}>
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expand row */}
                      {isOpen && (
                        <tr className="bg-muted/20">
                          <td colSpan={6} className="p-3">
                            <div className="grid gap-2">
                              <div className="text-sm font-medium">Cluster reports</div>
                              {loadingDetails[r.dedupe_sig] ? (
                                <div className="text-xs text-muted-foreground p-3">Loading…</div>
                              ) : !details[r.dedupe_sig]?.length ? (
                                <div className="text-xs text-muted-foreground p-3">No items.</div>
                              ) : (
                                <div className="grid gap-2">
                                  {details[r.dedupe_sig]?.map((d) => (
                                    <div key={d.id} className="rounded border p-2 flex items-center justify-between">
                                      <div className="min-w-0">
                                        <div className="text-xs text-muted-foreground">
                                          Lead <code className="font-mono">{d.id.slice(0, 8)}…</code> · Scout <code className="font-mono">{d.scout_id.slice(0, 8)}…</code> · {fmtDT(d.created_at)}
                                        </div>
                                        {d.notes && <div className="text-sm mt-0.5">{d.notes}</div>}
                                      </div>
                                      <div>
                                        {d.status === 'linked' && <Badge className="bg-emerald-600 hover:bg-emerald-600">linked</Badge>}
                                        {d.status === 'pending' && <Badge variant="secondary">pending</Badge>}
                                        {d.status === 'rejected' && <Badge className="bg-rose-600 hover:bg-rose-600">rejected</Badge>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Link panel with search + inline Create & Link */}
                      {linkOpenFor === r.dedupe_sig && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <div className="border-t bg-background">
                              <div className="p-4 grid lg:grid-cols-[1fr,340px] gap-4">
                                {/* LEFT: search & select existing player */}
                                <div className="grid gap-2">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium">Link group to player</div>
                                    <Button variant="ghost" onClick={() => setLinkOpenFor(null)}>Close</Button>
                                  </div>
                                  <Label>Search player</Label>
                                  <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      className="pl-8"
                                      value={searchQ}
                                      onChange={(e) => searchPlayers(e.target.value)}
                                      placeholder="Type at least 2 characters…"
                                    />
                                  </div>
                                  <div className="rounded border max-h-64 overflow-auto">
                                    {searching ? (
                                      <div className="p-3 text-xs text-muted-foreground">Searching…</div>
                                    ) : searchResults.length === 0 ? (
                                      <div className="p-3 text-xs text-muted-foreground">No results</div>
                                    ) : (
                                      searchResults.map((p) => (
                                        <button
                                          key={p.id}
                                          className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-3"
                                          onClick={() => linkSigToPlayer(r.dedupe_sig, r.lead_id, p.id)}
                                          disabled={linkingSig === r.dedupe_sig}
                                        >
                                          {p.image_url ? (
                                            <img src={p.image_url} alt={p.full_name} className="h-8 w-8 rounded-full object-cover border" />
                                          ) : (
                                            <div className="h-8 w-8 rounded-full bg-muted border" />
                                          )}
                                          <div className="min-w-0">
                                            <div className="text-sm font-medium truncate">{p.full_name}</div>
                                            <div className="text-[11px] text-muted-foreground truncate">
                                              {p.main_position || '—'} · {p.current_club_name || '—'}
                                              {p.current_club_country ? ` (${p.current_club_country})` : ''}
                                            </div>
                                          </div>
                                          <div className="ml-auto text-xs text-primary">
                                            {linkingSig === r.dedupe_sig ? 'Linking…' : 'Link'}
                                          </div>
                                        </button>
                                      ))
                                    )}
                                  </div>
                                </div>

                                {/* RIGHT: Inline Create & Link */}
                                <div className="rounded-lg border p-3 grid gap-2">
                                  <div className="font-medium mb-1">Or create & link</div>
                                  <div className="grid gap-2">
                                    <div className="grid gap-1.5">
                                      <Label>Full name *</Label>
                                      <Input
                                        value={createFullName}
                                        onChange={(e) => setCreateFullName(e.target.value)}
                                        placeholder="e.g. John Doe"
                                      />
                                    </div>
                                    <div className="grid gap-1.5">
                                      <Label>Date of birth *</Label>
                                      <Input
                                        type="date"
                                        value={createDob}
                                        onChange={(e) => setCreateDob(e.target.value)}
                                      />
                                    </div>
                                    <div className="grid gap-1.5">
                                      <Label>Main position</Label>
                                      <Input
                                        value={createMainPos}
                                        onChange={(e) => setCreateMainPos(e.target.value)}
                                        placeholder="e.g. CM, ST, CB"
                                      />
                                    </div>
                                    <div className="grid gap-1.5">
                                      <Label>Current club</Label>
                                      <Input
                                        value={createClub}
                                        onChange={(e) => setCreateClub(e.target.value)}
                                        placeholder="Club name"
                                      />
                                    </div>
                                    <div className="grid gap-1.5">
                                      <Label>Club country</Label>
                                      <Input
                                        value={createClubCountry}
                                        onChange={(e) => setCreateClubCountry(e.target.value)}
                                        placeholder="e.g. Poland"
                                      />
                                    </div>
                                    <div className="grid gap-1.5">
                                      <Label>Transfermarkt URL</Label>
                                      <Input
                                        value={createTmUrl}
                                        onChange={(e) => setCreateTmUrl(e.target.value)}
                                        placeholder="https://www.transfermarkt.com/..."
                                      />
                                    </div>
                                    <Button
                                      className="mt-1"
                                      onClick={() => createAndLink(r.dedupe_sig, r.lead_id)}
                                      disabled={createBusy}
                                    >
                                      {createBusy ? 'Creating…' : 'Create & Link'}
                                    </Button>

                                    <div className="text-[11px] text-muted-foreground">
                                      Tip: the header “Create player” opens the full form in a new tab.
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
