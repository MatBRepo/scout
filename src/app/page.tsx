import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { signOutAction } from "./actions/auth"
import SoccerField from "@/components/interactive/SoccerField"
import {
  ShieldCheck, Lock, Zap, Search, UserPlus, RefreshCcw, Users, PanelsTopLeft,
  Sparkles, Star, Send, ArrowRight
} from "lucide-react"

export const dynamic = "force-dynamic"

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let role: "scout" | "admin" | null = null
  if (user?.id) {
    const { data: p } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
    role = (p?.role as any) ?? null
  }

  return (
    <main className="relative min-h-dvh">
      {/* Soft background flourishes */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background" />
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl opacity-30" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl opacity-30" />
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-12 pt-20 md:pt-28">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          {/* Left copy */}
          <div className="space-y-6">
            {/* Badges row */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground bg-background/70">
                <ShieldCheck className="h-3.5 w-3.5" />
                Secure scouting workspace
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground bg-background/70">
                <Lock className="h-3.5 w-3.5" />
                Private by default
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground bg-background/70">
                <Zap className="h-3.5 w-3.5" />
                Real-time sync
              </span>
            </div>

            <h1 className="text-4xl/tight font-bold md:text-5xl">
              Discover. Evaluate. <span className="text-primary">Sign</span>.
            </h1>
            <p className="max-w-prose text-muted-foreground">
              A lightweight scouting platform to discover players, track shortlists,
              and collaborate with your team — powered by Next.js &amp; Supabase.
            </p>

            {/* CTAs */}
            {user ? (
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="gap-2">
                  <Link href="/scout/discover"><Search className="h-4 w-4" /> Discover players</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="gap-2">
                  <Link href="/scout/my-players"><Users className="h-4 w-4" /> My Players</Link>
                </Button>
                {role === "admin" && (
                  <Button asChild variant="ghost" size="lg" className="gap-2">
                    <Link href="/admin"><PanelsTopLeft className="h-4 w-4" /> Admin</Link>
                  </Button>
                )}
                <form action={signOutAction}>
                  <Button type="submit" variant="ghost" size="lg" className="gap-2">
                    <Send className="h-4 w-4 -rotate-45" />
                    Sign out
                  </Button>
                </form>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="gap-2">
                  <Link href="/auth"><Search className="h-4 w-4" /> Log in</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="gap-2">
                  <Link href="/auth"><UserPlus className="h-4 w-4" /> Create an account</Link>
                </Button>
              </div>
            )}

            {!user && (
              <p className="text-xs text-muted-foreground">
                By continuing you agree to our Terms &amp; Privacy Policy.
              </p>
            )}
          </div>

          {/* Right visual */}
          <Card className="rounded-2xl border shadow-sm p-5 md:p-6">
            <div className="space-y-5">
              <div className="aspect-[16/10] w-full overflow-hidden rounded-xl border bg-muted">
                {/* Interactive field */}
                <SoccerField />
              </div>

              {/* Quick tips row */}
              <div className="grid gap-3 sm:grid-cols-3">
                <Tip icon={<Sparkles className="h-4 w-4" />} title="Smart discover" desc="Filter by name & interest." />
                <Tip icon={<RefreshCcw className="h-4 w-4" />} title="Transfer sync" desc="Fast profile imports." />
                <Tip icon={<Star className="h-4 w-4" />} title="My list" desc="Shortlist in one click." />
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowRight className="h-4 w-4" />
          Highlights
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <Feature icon={<Search className="h-5 w-5" />} title="Fast filtering" desc="Positions, countries, interest" />
          <Feature icon={<Users className="h-5 w-5" />} title="My Players" desc="Private shortlist per scout" />
          <Feature icon={<RefreshCcw className="h-5 w-5" />} title="Rich profiles" desc="Photo, club, market, bio" />
          <Feature icon={<PanelsTopLeft className="h-5 w-5" />} title="Admin tools" desc="Manage users & duplicates" />
          <Feature icon={<Zap className="h-5 w-5" />} title="Responsive" desc="Mobile and desktop first" />
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-6 pb-10">
        <div className="flex flex-col items-center justify-between gap-3 border-t pt-6 text-xs text-muted-foreground md:flex-row">
          <span>© {new Date().getFullYear()} S4S</span>
          <div className="flex items-center gap-4">
            {!user ? (
              <Link href="/auth" className="hover:underline">Sign in</Link>
            ) : (
              <form action={signOutAction}>
                <button className="hover:underline" type="submit">Sign out</button>
              </form>
            )}
            <Link href="/scout/discover" className="hover:underline">Explore</Link>
            {role === "admin" && <Link href="/admin" className="hover:underline">Admin</Link>}
          </div>
        </div>
      </footer>
    </main>
  )
}

/* ---------- Small presentational helpers (server-safe) ---------- */

function Tip({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border p-4 transition hover:bg-muted/50">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <div className="text-sm font-medium">{title}</div>
      </div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </div>
  )
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card className="rounded-2xl p-4 transition hover:shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </Card>
  )
}
