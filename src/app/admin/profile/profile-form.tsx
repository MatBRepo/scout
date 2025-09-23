// src/app/admin/profile/profile-form.tsx
"use client"

import { useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import Image from "next/image"
import { createClient } from "@/lib/supabase/browser"
import type { Profile } from "./page"

export default function ProfileForm({ initialProfile }: { initialProfile?: Profile }) {
  const supabase = createClient()
  const [fullName, setFullName] = useState(initialProfile?.full_name ?? "")
  const [avatarUrl, setAvatarUrl] = useState(initialProfile?.avatar_url ?? "")
  const [isPending, startTransition] = useTransition()

  const onSave = () => {
    // startTransition callback must be synchronous (return void)
    startTransition(() => {
      ;(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          toast.error("You are not signed in.")
          return
        }

        const { error } = await supabase.from("profiles").upsert({
          id: user.id,
          full_name: fullName || null,
          avatar_url: avatarUrl || null,
        })

        if (error) {
          toast.error(error.message)
        } else {
          toast.success("Profile updated")
        }
      })()
    })
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-muted grid place-items-center text-xs">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="Avatar" width={64} height={64} />
          ) : (
            "No avatar"
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          Recommended: square image (e.g. 256×256).
        </div>
      </div>

      <div className="grid gap-3">
        <Label htmlFor="full_name">Full name</Label>
        <Input
          id="full_name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Doe"
        />
      </div>

      <div className="grid gap-3">
        <Label htmlFor="avatar_url">Avatar URL</Label>
        <Input
          id="avatar_url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://…/avatar.png"
        />
      </div>

      <Card className="p-4 text-sm text-muted-foreground">
        Tip: If you use Supabase Storage, upload to a public bucket and paste the public URL here.
      </Card>

      <div className="flex gap-2">
        <Button disabled={isPending} onClick={onSave}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  )
}
