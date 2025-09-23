// src/app/auth/page.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/browser"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { LogIn, UserPlus, Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from "lucide-react"
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

  // If already signed in, bounce to app
  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      if (data.user) router.replace("/scout/discover")
    })
    return () => { mounted = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const switchMode = (to: Mode) => {
    setMode(to)
    setPassword("")
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error("Please fill in email and password.")
      return
    }
    setLoading(true)
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        toast.success("Welcome back!")
        router.replace("/scout/discover")
      } else {
        // register
        if (!fullName.trim()) {
          toast.error("Please provide your full name.")
          return
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: typeof window !== "undefined" ? `${location.origin}/auth/update-password` : undefined,
          },
        })
        if (error) throw error
        toast.success("Check your inbox to confirm your email.")
        // keep user on page; they can switch to login after confirming
      }
    } catch (err: any) {
      toast.error(err?.message || "Authentication failed")
    } finally {
      setLoading(false)
    }
  }

  const signInWithGoogle = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? `${location.origin}/scout/discover` : undefined,
        },
      })
      if (error) throw error
    } catch (err: any) {
      toast.error(err?.message || "Google sign-in failed")
      setLoading(false)
    }
  }

  const resetPassword = async () => {
    if (!email) {
      toast.message("Enter your email first", { description: "We’ll send you a reset link." })
      return
    }
    try {
      const redirectTo = typeof window !== "undefined" ? `${location.origin}/auth/update-password` : undefined
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) throw error
      toast.success("Password reset email sent")
    } catch (err: any) {
      toast.error(err?.message || "Could not send reset email")
    }
  }

  return (
    <div className="min-h-svh grid md:grid-cols-2">
      {/* Left pane (nice hero) */}
      <div className="hidden md:flex items-center justify-center bg-gradient-to-br from-primary/10 via-muted to-background p-10">
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
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Go to website <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Right pane (card form) */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-6 rounded-2xl shadow-sm">
          {/* Toggle */}
          <div className="mb-6 grid grid-cols-2 rounded-xl border p-1 bg-muted/40">
            <button
              type="button"
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition",
                mode === "login" ? "bg-background shadow text-foreground" : "text-muted-foreground"
              )}
              onClick={() => switchMode("login")}
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
            >
              <div className="flex items-center justify-center gap-2">
                <UserPlus className="h-4 w-4" /> Register
              </div>
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  className="pl-9"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  className="pl-9 pr-9"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === "login" && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline mt-1"
                  onClick={resetPassword}
                >
                  Forgot password?
                </button>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or continue with</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={signInWithGoogle}
              disabled={loading}
            >
              Continue with Google
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              By continuing, you agree to our{" "}
              <span className="underline">Terms</span> and{" "}
              <span className="underline">Privacy Policy</span>.
            </p>
          </form>
        </Card>
      </div>
    </div>
  )
}
