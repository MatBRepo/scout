// src/app/auth/page.tsx
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/browser"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  LogIn,
  UserPlus,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  MailCheck,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type Mode = "login" | "register"

export default function AuthPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("") // register only
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  // form error (shown under password for login)
  const [formError, setFormError] = useState<string | null>(null)

  // post-register UX
  const [justRegisteredEmail, setJustRegisteredEmail] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0) // seconds until we can call auth again

  // focus management for small UX win
  const emailRef = useRef<HTMLInputElement | null>(null)
  const nameRef = useRef<HTMLInputElement | null>(null)

  const APP_HOME = "/scout/discover"
  const CONFIRM_PATH = "/auth/confirm"
  const UPDATE_PASSWORD_PATH = "/auth/update-password"

  // derived validity
  const emailValid = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email])
  const pwdValidForLogin = password.length > 0
  const pwdValidForRegister = password.length >= 8
  const nameValid = mode === "register" ? fullName.trim().length >= 2 : true

  const canSubmit = useMemo(() => {
    if (mode === "login") return emailValid && pwdValidForLogin
    return emailValid && pwdValidForRegister && nameValid
  }, [mode, emailValid, pwdValidForLogin, pwdValidForRegister, nameValid])

  // cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])
  const startCooldown = (secs = 6) => setCooldown(secs)

  // Already signed in? bounce
  useEffect(() => {
    let alive = true
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return
      if (data?.user) {
        router.replace(APP_HOME)
        router.refresh()
      }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!alive) return
      if (event === "SIGNED_IN") {
        router.replace(APP_HOME)
        router.refresh()
      }
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchMode = useCallback(
    (to: Mode) => {
      if (loading) return
      setMode(to)
      setPassword("")
      setFormError(null)
      // focus the first relevant field
      setTimeout(() => {
        if (to === "register") nameRef.current?.focus()
        else emailRef.current?.focus()
      }, 0)
    },
    [loading]
  )

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (loading || cooldown > 0 || !canSubmit) return

      setLoading(true)
      try {
        if (mode === "login") {
          setFormError(null)
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) {
            const msg = (error as any)?.message?.toLowerCase?.() ?? ""
            if (msg.includes("invalid login credentials")) {
              setFormError("Wrong email or password.")
              return
            }
            if (msg.includes("email") && msg.includes("confirm")) {
              setFormError("Please confirm your email first. Check your inbox.")
              return
            }
            setFormError("Could not sign in. Please try again.")
            return
          }
          toast.success("Welcome back!")
          router.replace(APP_HOME)
          router.refresh()
        } else {
          // REGISTER
          if (!nameValid) {
            toast.error("Please provide your full name.")
            return
          }
          if (!pwdValidForRegister) {
            toast.error("Password must be at least 8 characters.")
            return
          }

          const emailRedirectTo =
            typeof window !== "undefined" ? `${location.origin}${CONFIRM_PATH}` : undefined

          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName },
              emailRedirectTo,
            },
          })
          if (error) {
            if (typeof error.message === "string" && /only request this after/i.test(error.message)) {
              startCooldown(6)
              toast.message("Please wait a moment", {
                description: "You can request this again in a few seconds.",
              })
            }
            throw error
          }

          // Success UX: banner + toast
          setJustRegisteredEmail(email)
          setPassword("")
          toast.success("Confirmation email sent. Check your inbox.")
        }
      } catch (err: any) {
        if (!/only request this after/i.test(err?.message ?? "")) {
          toast.error(err?.message || "Authentication failed")
        }
      } finally {
        setLoading(false)
      }
    },
    [
      APP_HOME,
      CONFIRM_PATH,
      canSubmit,
      cooldown,
      email,
      fullName,
      mode,
      nameValid,
      password,
      pwdValidForRegister,
      router,
      supabase,
      loading,
    ]
  )

  const signInWithGoogle = useCallback(async () => {
    if (loading || cooldown > 0) return
    setLoading(true)
    try {
      const redirectTo =
        typeof window !== "undefined" ? `${location.origin}${APP_HOME}` : undefined
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      })
      if (error) {
        if (typeof error.message === "string" && /only request this after/i.test(error.message)) {
          startCooldown(6)
          toast.message("Please wait a moment", {
            description: "You can request this again in a few seconds.",
          })
        }
        throw error
      }
      // redirects away
    } catch (err: any) {
      toast.error(err?.message || "Google sign-in failed")
      setLoading(false)
    }
  }, [APP_HOME, cooldown, loading, supabase])

  const resetPassword = useCallback(async () => {
    if (!email) {
      toast.message("Enter your email first", { description: "We’ll send you a reset link." })
      return
    }
    try {
      const redirectTo =
        typeof window !== "undefined" ? `${location.origin}${UPDATE_PASSWORD_PATH}` : undefined
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) {
        if (typeof error.message === "string" && /only request this after/i.test(error.message)) {
          startCooldown(6)
          toast.message("Please wait a moment", {
            description: "You can request this again in a few seconds.",
          })
        }
        throw error
      }
      toast.success("Password reset email sent")
    } catch (err: any) {
      if (!/only request this after/i.test(err?.message ?? "")) {
        toast.error(err?.message || "Could not send reset email")
      }
    }
  }, [UPDATE_PASSWORD_PATH, email, supabase])

  const resendConfirmation = useCallback(async () => {
    if (!justRegisteredEmail || loading || cooldown > 0) return
    setLoading(true)
    try {
      const redirectTo =
        typeof window !== "undefined" ? `${location.origin}${CONFIRM_PATH}` : undefined
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: justRegisteredEmail,
        options: { emailRedirectTo: redirectTo },
      })
      if (error) {
        if (typeof error.message === "string" && /only request this after/i.test(error.message)) {
          startCooldown(6)
          toast.message("Please wait a moment", {
            description: "You can request this again in a few seconds.",
          })
        }
        throw error
      }
      startCooldown(6)
      toast.success("Confirmation email re-sent")
    } catch (err: any) {
      if (!/only request this after/i.test(err?.message ?? "")) {
        toast.error(err?.message || "Could not resend email")
      }
    } finally {
      setLoading(false)
    }
  }, [CONFIRM_PATH, cooldown, justRegisteredEmail, loading, supabase])

  return (
    <div className="min-h-svh grid md:grid-cols-2">
      {/* Left pane */}
      <div className="hidden md:flex items-center justify-center  p-10">
        <div className="max-w-sm text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure access
          </div>
          <h1 className="text-3xl font-bold">S4S Admin</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to manage players, discover talent, and collaborate with your scouting team.
          </p>
          <div className="flex justify-center">
            <Link href="/" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Go to website <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Right pane */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-6 rounded-2xl shadow-sm">
          {/* Header (small UX tweak) */}
          <div className="mb-5">
            <h2 className="text-xl font-semibold">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {mode === "login"
                ? "Enter your credentials to access the dashboard."
                : "Join your scouting workspace in a minute."}
            </p>
          </div>

          {/* Post-register notice */}
          {justRegisteredEmail && (
            <div className="mb-6 rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex items-start gap-2">
                <MailCheck className="mt-0.5 h-4 w-4 text-primary" />
                <div>
<div style={{ width: "90%", margin: "0 auto" }}>
                    We’ve sent a confirmation link to <b>{justRegisteredEmail}</b>. Check your inbox
                    (and spam). After confirming, you’ll be redirected automatically.
                  </div>
                  <div className="mt-1" style={{ width: "90%", margin: "0 auto" }}>
                    <button
                      type="button"
                      onClick={resendConfirmation}
                      className="text-xs underline disabled:opacity-60"
                      disabled={loading || cooldown > 0}
                    >
                      {cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend email"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Segmented toggle */}
          <div className="mb-6 grid grid-cols-2 rounded-xl border p-1 bg-muted/40">
            <button
              type="button"
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition",
                mode === "login" ? "bg-background shadow text-foreground" : "text-muted-foreground"
              )}
              onClick={() => switchMode("login")}
              disabled={loading}
            >
              <div className="flex items-center justify-center gap-2">
                <LogIn className="h-4 w-4" /> Log in
              </div>
            </button>
            <button
              type="button"
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition",
                mode === "register" ? "bg-background shadow text-foreground" : "text-muted-foreground"
              )}
              onClick={() => switchMode("register")}
              disabled={loading}
            >
              <div className="flex items-center justify-center gap-2">
                <UserPlus className="h-4 w-4" /> Register
              </div>
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  ref={nameRef}
                  id="fullName"
                  name="fullName"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  disabled={loading}
                />
                {!nameValid && fullName.length > 0 && (
                  <p className="text-xs text-destructive">Enter at least 2 characters.</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="email"
                  className={cn("pl-9", email && !emailValid && "border-destructive focus-visible:ring-destructive")}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setFormError(null)
                  }}
                  autoComplete="email"
                  inputMode="email"
                  disabled={loading}
                />
              </div>
              {email && !emailValid && (
                <p className="text-xs text-destructive">Enter a valid email address.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPwd ? "text" : "password"}
                  className={cn(
                    "pl-9 pr-9",
                    formError && mode === "login" && "border-destructive focus-visible:ring-destructive",
                    mode === "register" && password && !pwdValidForRegister && "border-destructive focus-visible:ring-destructive"
                  )}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setFormError(null)
                  }}
                  aria-invalid={!!formError && mode === "login"}
                  aria-describedby={formError && mode === "login" ? "password-error" : undefined}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
                  aria-label={showPwd ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Inline error for login */}
              {mode === "login" && formError && (
                <p id="password-error" className="mt-1 text-xs text-destructive">
                  {formError}
                </p>
              )}

              {mode === "login" && (
                <button
                  type="button"
                  className="mt-1 text-xs text-muted-foreground hover:underline"
                  onClick={resetPassword}
                  disabled={loading}
                >
                  Forgot password?
                </button>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading || cooldown > 0}>
              {loading
                ? "Please wait…"
                : cooldown > 0
                ? `Try again in ${cooldown}s`
                : mode === "login"
                ? "Log in"
                : "Create account"}
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={signInWithGoogle}
              disabled={loading || cooldown > 0}
            >
              Continue with Google
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              By continuing, you agree to our <span className="underline">Terms</span> and{" "}
              <span className="underline">Privacy Policy</span>.
            </p>
          </form>
        </Card>
      </div>
    </div>
  )
}
