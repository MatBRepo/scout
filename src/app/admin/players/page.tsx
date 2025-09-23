// src/app/admin/players/page.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import AdminPlayersGrid from "./_components/AdminPlayersGrid"

export const dynamic = "force-dynamic"

export default async function AdminPlayersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (me?.role !== "admin") redirect("/")

  return <AdminPlayersGrid />
}
