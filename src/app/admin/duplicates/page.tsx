// src/app/admin/duplicates/page.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"

export const dynamic = "force-dynamic"

type DupRow = {
  full_name_norm: string
  date_of_birth: string | null
  scouts_count: number
  entries_count: number
  entry_ids: string[] | null
}

export default async function DuplicatesPage() {
  const supabase = await createClient() // ✅ await
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (me?.role !== "admin") redirect("/")

  const { data, error } = await supabase
    .from("duplicate_candidates")
    .select("full_name_norm, date_of_birth, scouts_count, entries_count, entry_ids")
    .order("scouts_count", { ascending: false })

  if (error) {
    return <div className="text-sm text-red-600">Error: {error.message}</div>
  }

  const rows = (data ?? []) as DupRow[]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Potential Duplicates</h1>
      <div className="grid gap-3">
        {rows.map((r, i) => (
          <Card key={i} className="p-4">
            <div className="font-medium">{r.full_name_norm}</div>
            <div className="text-xs text-muted-foreground">
              DoB: {r.date_of_birth ?? "—"} · Scouts: {r.scouts_count} · Entries: {r.entries_count}
            </div>
            {r.entry_ids?.length ? (
              <div className="mt-2 text-xs text-muted-foreground">Entry IDs: {r.entry_ids.join(", ")}</div>
            ) : null}
          </Card>
        ))}
        {!rows.length && <div className="text-sm text-muted-foreground">No duplicates found.</div>}
      </div>
    </div>
  )
}
