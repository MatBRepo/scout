// src/components/auth/SignOutButton.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/browser"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

type Props = {
  className?: string
  children?: React.ReactNode
  icon?: React.ReactNode
  redirectTo?: string // where to send the user after sign out
}

export default function SignOutButton({
  className,
  children = "Sign out",
  icon,
  redirectTo = "/(auth)",
}: Props) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      setLoading(true)
      await supabase.auth.signOut()
      router.replace(redirectTo) // go to your login/register page
      router.refresh()           // ensure layouts re-render without session
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className={className}
      onClick={handleSignOut}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </Button>
  )
}
