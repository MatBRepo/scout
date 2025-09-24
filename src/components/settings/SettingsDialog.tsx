// src/components/settings/SettingsDialog.tsx
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/browser"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { Image as ImageIcon, UploadCloud, X } from "lucide-react"

type Props = { open: boolean; onOpenChange: (v: boolean) => void }
type Role = "scout" | "scout_agent" | "admin"

export default function SettingsDialog({ open, onOpenChange }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [hydrating, setHydrating] = useState(false)

  // Profile fields
  const [full_name, setFullName] = useState("")
  const [avatar_url, setAvatarUrl] = useState("")
  const [country, setCountry] = useState("")
  const [agency, setAgency] = useState("")
  const [phone, setPhone] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [role, setRole] = useState<Role>("scout")

  const userIdRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Load profile when dialog opens
  useEffect(() => {
    if (!open) return
    ;(async () => {
      setHydrating(true)
      const { data: { user }, error: uerr } = await supabase.auth.getUser()
      if (uerr) { toast.error(uerr.message); setHydrating(false); return }
      if (!user) { toast.message("Please sign in"); setHydrating(false); return }
      userIdRef.current = user.id

      const { data: p, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, country, phone, whatsapp, agency, role")
        .eq("id", user.id)
        .maybeSingle()

      if (error) toast.error(error.message)
      setFullName(p?.full_name ?? "")
      setAvatarUrl(p?.avatar_url ?? "")
      setCountry(p?.country ?? "")
      setPhone(p?.phone ?? "")
      setWhatsapp(p?.whatsapp ?? "")
      setAgency(p?.agency ?? "")
      setRole((p?.role as Role) ?? "scout")
      setHydrating(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  /* ---------- Drag & drop upload ---------- */
  const [dragOver, setDragOver] = useState(false)
  const acceptMime = useMemo(() => ["image/png", "image/jpeg", "image/webp"], [])

  function onFileChosen(f: File | null) {
    if (!f) return
    if (!acceptMime.includes(f.type)) {
      toast.error("Unsupported file type")
      return
    }
    uploadAvatar(f)
  }

  async function uploadAvatar(file: File) {
    const userId = userIdRef.current
    if (!userId) { toast.error("Not signed in"); return }

    setLoading(true)
    try {
      const bucket = "avatars" // make sure this bucket exists (public: true)
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
      const path = `${userId}/${Date.now()}.${ext}`

      // Upsert file
      const { error: upErr } = await supabase
        .storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr

      // Get public URL
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
      const url = pub.publicUrl
      setAvatarUrl(url)
      toast.success("Avatar uploaded")
    } catch (e: any) {
      toast.error(e?.message || "Upload failed")
    } finally {
      setLoading(false)
    }
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    onFileChosen(file || null)
  }

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: { user }, error: uerr } = await supabase.auth.getUser()
      if (uerr) throw uerr
      if (!user) throw new Error("Not signed in")

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: full_name || null,
        avatar_url: avatar_url || null,
        country: country || null,
        phone: phone || null,
        whatsapp: whatsapp || null,
        agency: agency || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" })
      if (error) throw error

      toast.success("Profile saved")
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message || "Could not save profile")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Account Settings</DialogTitle>
          <DialogDescription>Update your profile and avatar.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSave} className="space-y-6 px-6 pb-6">
          {/* Avatar uploader */}
          <Card
            className={[
              "p-4 sm:p-5 transition",
              dragOver ? "ring-2 ring-primary/50" : "",
            ].join(" ")}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <div className="flex items-center gap-4">
              {/* preview */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatar_url || "/placeholder.svg"}
                alt="Avatar"
                className="h-16 w-16 rounded-full border object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">Avatar</div>
                <div className="text-xs text-muted-foreground">
                  Drag & drop an image here, or choose a file (PNG/JPG/WebP).
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                  >
                    <UploadCloud className="h-4 w-4" />
                    Choose file
                  </Button>
                  {avatar_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                      onClick={() => setAvatarUrl("")}
                    >
                      <X className="h-4 w-4" />
                      Remove
                    </Button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={acceptMime.join(",")}
                    className="hidden"
                    onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Profile fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" value={full_name} onChange={e => setFullName(e.target.value)} />
            </div>
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

          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Role: <span className="font-medium">{role}</span> (managed by admin)
            </div>
            <Button type="submit" disabled={loading || hydrating}>
              {loading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
