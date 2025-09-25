// src/components/auth/SignOutButton.tsx
"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/browser"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

type SignOutButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "onClick" | "children"
> & {
  /** Visible label. Default: "Sign out" */
  children?: React.ReactNode
  /** Optional leading icon */
  icon?: React.ReactNode
  /** Where to send the user after sign out. Default: "/login" */
  redirectTo?: string
  /** Ask the user before signing out */
  confirm?: boolean
  /** Callback fired after successful sign-out (before navigation refresh) */
  onSignedOut?: () => void
}

export default function SignOutButton({
  className,
  children = "Sign out",
  icon,
  redirectTo = "/auth", // IMPORTANT: route groups (/(auth)) don't exist in the URL
  confirm = false,
  onSignedOut,
  disabled,
  ...buttonProps
}: SignOutButtonProps) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const handleSignOut = useCallback(async () => {
    if (loading) return
    try {
      if (confirm && !window.confirm("Na pewno chcesz się wylogować?")) return
      setLoading(true)

      const { error } = await supabase.auth.signOut()
      if (error) throw error

      onSignedOut?.()
      toast.success("Wylogowano pomyślnie")

      // Navigate then refresh to re-render layouts without session
      router.replace(redirectTo)
      router.refresh()
    } catch (err: any) {
      console.error("[SignOutButton] signOut error:", err)
      toast.error("Nie udało się wylogować. Spróbuj ponownie.")
    } finally {
      setLoading(false)
    }
  }, [confirm, loading, onSignedOut, redirectTo, router, supabase])

  return (
    <Button
      type="button"
      variant="ghost"
      className={className}
      onClick={handleSignOut}
      disabled={disabled || loading}
      aria-busy={loading}
      aria-label={typeof children === "string" ? children : "Sign out"}
      {...buttonProps}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
      ) : (
        icon ?? null
      )}
      <span>{children}</span>
    </Button>
  )
}
