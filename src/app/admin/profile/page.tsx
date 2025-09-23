// src/app/admin/profile/page.tsx
import { createClient } from "@/lib/supabase/server"
import ProfileForm from "./profile-form"
import { Card } from "@/components/ui/card"

export type Profile = { id: string; full_name: string | null; avatar_url: string | null }

async function getInitialData() {
  const supabase = await createClient(); // 👈 await here
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { email: null, profile: null }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", user.id)
    .single()

  return { email: user.email, profile: (profile as Profile) ?? null }
}

export default async function ProfilePage() {
  const { email, profile } = await getInitialData()
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Your Profile</h1>
        <p className="text-muted-foreground">Manage your name and avatar.</p>
      </div>
      <Card className="p-6">
        <div className="mb-6 text-sm text-muted-foreground">
          Signed in as <span className="font-medium">{email}</span>
        </div>
        <ProfileForm initialProfile={profile ?? undefined} />
      </Card>
    </div>
  )
}
