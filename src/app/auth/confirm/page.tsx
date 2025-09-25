// src/app/auth/confirm/page.tsx
"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/browser"
import { type EmailOtpType } from "@supabase/supabase-js"
import { Loader2 } from "lucide-react"

// Ensure this page doesn't get statically prerendered (avoids build error)
export const dynamic = "force-dynamic"

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <Center>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Otwieranie linku potwierdzającego…
          </div>
        </Center>
      }
    >
      <ConfirmBody />
    </Suspense>
  )
}

function ConfirmBody() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const code = searchParams.get("code")
      const token_hash = searchParams.get("token_hash")
      const type = searchParams.get("type") as EmailOtpType | null
      const next = searchParams.get("next") || "/scout/discover"

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type })
          if (error) throw error
        } else {
          throw new Error("Brak kodu weryfikacyjnego w adresie URL.")
        }

        router.replace(next)
        router.refresh()
      } catch (err: any) {
        setErrorMsg(err?.message || "Nie udało się potwierdzić adresu e-mail.")
      }
    })()
  }, [router, searchParams, supabase])

  if (errorMsg) {
    return (
      <Center>
        <div className="text-sm text-red-600">{errorMsg}</div>
      </Center>
    )
  }

  return (
    <Center>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Potwierdzanie e-maila…
      </div>
    </Center>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh grid place-items-center p-6">{children}</div>
}
