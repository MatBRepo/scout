import { redirect } from "next/navigation"
import createClient from "@/lib/supabase/server"
import ScoutsTable from "./_components/ScoutsTable"

export default async function AdminScoutsPage() {
  const supabase = createClient() // sync; no await
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (me?.role !== "admin") redirect("/")

  return <ScoutsTable />
}
