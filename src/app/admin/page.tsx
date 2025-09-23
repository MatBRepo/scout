// src/app/admin/page.tsx
import { redirect } from "next/navigation"
import { Card } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic" // avoid caching the dashboard

async function getUserEmail() {
  const supabase = await createClient() // ⬅️ await
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email ?? "User"
}

async function getCounts() {
  const supabase = await createClient() // ⬅️ await
  try {
    const { count: usersCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
    return { usersCount: usersCount ?? 0 }
  } catch {
    return { usersCount: 0 }
  }
}

export default async function AdminHome() {
  // Require authenticated admin
  const supabase = await createClient() // ⬅️ await
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/") // or /login

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (me?.role !== "admin") redirect("/")

  const [email, counts] = await Promise.all([getUserEmail(), getCounts()])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {email}.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Users</div>
          <div className="mt-2 text-3xl font-bold">{counts.usersCount}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Revenue</div>
          <div className="mt-2 text-3xl font-bold">—</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Active Sessions</div>
          <div className="mt-2 text-3xl font-bold">—</div>
        </Card>
      </section>
    </div>
  )
}
