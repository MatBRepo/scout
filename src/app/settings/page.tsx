// app/settings/page.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import AccountSettings from "./ui/AccountSettings"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth")

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, role, country, phone, whatsapp, agency, is_active")
    .eq("id", user.id)
    .maybeSingle()

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 bg-gradient-to-br from-primary/10 via-muted to-background">
      <h1 className="text-2xl font-semibold mb-2">Settings</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Manage your profile and preferences.
      </p>
      <AccountSettings initial={profile ?? null} />
    </main>
  )
}
