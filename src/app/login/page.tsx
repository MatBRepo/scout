// src/app/login/page.tsx
"use client"

import { useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/browser"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()
  const params = useSearchParams()
  const redirect_to = params.get("redirect_to") ?? "/admin"

  const signInWithEmail = () => {
    startTransition(async () => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(redirect_to)}`,
        },
      })
      if (error) toast.error(error.message)
      else toast.success("Check your email for a login link.")
    })
  }

  const signInWithGoogle = () => {
    startTransition(async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(redirect_to)}`,
        },
      })
      if (error) toast.error(error.message)
    })
  }

  return (
    <div className="min-h-dvh grid place-items-center p-4">
      <Card className="w-full max-w-sm p-6 space-y-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted-foreground">Use email or Google to access admin.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" />
          <Button className="w-full" disabled={isPending || !email} onClick={signInWithEmail}>
            {isPending ? "Sending..." : "Send magic link"}
          </Button>
        </div>
        <div className="text-center text-sm text-muted-foreground">or</div>
        <Button variant="outline" className="w-full" onClick={signInWithGoogle}>
          Continue with Google
        </Button>
        <div className="text-xs text-center text-muted-foreground">
          <Link href="/">Back to site</Link>
        </div>
      </Card>
    </div>
  )
}
