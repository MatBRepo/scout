// app/settings/ui/AccountSettings.tsx
"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/browser"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

type Profile = {
  full_name: string | null
  avatar_url: string | null
  role: "scout" | "scout_agent" | "admin"
  country: string | null
  phone: string | null
  whatsapp: string | null
  agency: string | null
  is_active: boolean | null
} | null

export default function AccountSettings({ initial }: { initial: Profile }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const [full_name, setFullName] = useState(initial?.full_name ?? "")
  const [avatar_url, setAvatarUrl] = useState(initial?.avatar_url ?? "")
  const [country, setCountry] = useState(initial?.country ?? "")
  const [phone, setPhone] = useState(initial?.phone ?? "")
  const [whatsapp, setWhatsapp] = useState(initial?.whatsapp ?? "")
  const [agency, setAgency] = useState(initial?.agency ?? "")

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: { user }, error: uerr } = await supabase.auth.getUser()
      if (uerr) throw uerr
      if (!user) {
        toast.error("You must be signed in.")
        return
      }
      const { error } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          full_name,
          avatar_url: avatar_url || null,
          country: country || null,
          phone: phone || null,
          whatsapp: whatsapp || null,
          agency: agency || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      if (error) throw error
      toast.success("Profile updated")
    } catch (err: any) {
      toast.error(err?.message || "Could not update profile")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-6">
      <Card className="p-4 sm:p-6 space-y-4">
        <div>
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" value={full_name} onChange={e => setFullName(e.target.value)} />
        </div>

        <div>
          <Label htmlFor="avatar_url">Avatar URL</Label>
          <Input id="avatar_url" value={avatar_url} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://…" />
          {/* preview */}
          {avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar_url} alt="Avatar preview" className="mt-2 h-12 w-12 rounded-full border object-cover" />
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="country">Country</Label>
            <Input id="country" value={country} onChange={e => setCountry(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="agency">Agency</Label>
            <Input id="agency" value={agency} onChange={e => setAgency(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input id="whatsapp" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <div className="text-sm text-muted-foreground">
          Role: <span className="font-medium">{initial?.role ?? "scout"}</span> (managed by admin)
        </div>
      </Card>
    </form>
  )
}
