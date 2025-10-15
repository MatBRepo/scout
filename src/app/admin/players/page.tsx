// app/admin/players/page.tsx
'use client'

import {useEffect, useState} from 'react'
import {createClient} from '@/lib/supabase/browser'
import {Card} from '@/components/ui/card'

type Row = {
  player_id: string
  full_name: string
  date_of_birth: string
  main_position: string | null
  current_club_name: string | null
  current_club_country: string | null
  transfermarkt_player_id: string | null
  transfermarkt_url: string | null
  image_url: string | null
  scouts_count: number
  scout_ids: string[]
  entries_count: number
  linked_leads_count: number
  created_at: string
  updated_at: string
}

export default function AdminPlayersPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('admin_players_unified').select('*').order('updated_at', {ascending:false})
      setRows((data || []) as any)
    })()
  }, [])

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Players (Unified)</h1>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {rows.map(r => (
          <Card key={r.player_id} className="p-4">
            <div className="flex gap-3">
              {r.image_url
                ? <img src={r.image_url} alt={r.full_name} className="h-16 w-16 rounded object-cover border" />
                : <div className="h-16 w-16 rounded border grid place-items-center text-xs text-muted-foreground">No photo</div>}
              <div className="min-w-0">
                <div className="font-medium truncate">{r.full_name}</div>
                <div className="text-xs text-muted-foreground">{r.date_of_birth}</div>
                <div className="text-xs">{r.main_position ?? '—'} {r.current_club_name ? `· ${r.current_club_name}` : ''} {r.current_club_country ? `(${r.current_club_country})` : ''}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Scouts: {r.scouts_count} · Entries: {r.entries_count} · Linked leads: {r.linked_leads_count}
                </div>
                {r.transfermarkt_url && (
                  <a className="text-xs text-primary underline" href={r.transfermarkt_url} target="_blank" rel="noreferrer">
                    Transfermarkt
                  </a>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
