"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/browser"
import { Button } from "@/components/ui/button"

import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import SignOutButton from "@/components/auth/SignOutButton"
import {
  Bell, Shield, UserRound, LogOut, Settings, ChevronDown, Menu,
  PanelLeftClose, UserPlus, NotebookPen
} from "lucide-react"
import { cn } from "@/lib/utils"

type Role = "scout" | "admin" | null

function RoleBadge({ role }: { role: Role }) {
  if (!role) return null
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
        role === "admin" ? "border-primary/40 text-primary" : "text-muted-foreground"
      )}
      title={role === "admin" ? "Admin" : "Scout"}
    >
      <Shield className="h-3.5 w-3.5" />
      {role === "admin" ? "Admin" : "Scout"}
    </span>
  )
}

export function Topbar() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [role, setRole] = useState<Role>(null)

  const [q, setQ] = useState("")

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!mounted) return
        if (!user) { setLoading(false); return }
        setEmail(user.email ?? null)
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, role")
          .eq("id", user.id)
          .maybeSingle()
        if (!mounted) return
        setFullName(p?.full_name ?? null)
        setAvatarUrl(p?.avatar_url ?? null)
        setRole((p?.role as Role) ?? "scout")
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const initials =
    (fullName?.trim()?.split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join("") ||
      email?.[0]?.toUpperCase() ||
      "U")

  const toggleSidebarMobile = () => {
    window.dispatchEvent(new Event("app:toggle-sidebar"))
  }
  const toggleSidebarCollapse = () => {
    window.dispatchEvent(new Event("app:toggle-collapse"))
  }
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const term = q.trim()
      if (!term) return
      router.push(`/scout/discover?search=${encodeURIComponent(term)}`)
    }
  }

  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/40">
      <div className="mx-auto flex h-full max-w-screen-2xl items-center gap-2 px-0">
        {/* Left cluster: mobile hamburger + brand */}
        <div className="flex items-center gap-2 md:gap-3">
          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            aria-label="Open menu"
            onClick={toggleSidebarMobile}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Desktop collapse button */}
          <Button
            variant="outline"
            size="icon"
            className="hidden md:inline-flex"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            onClick={toggleSidebarCollapse}
          >
            <PanelLeftClose className="h-5 w-5" />
          </Button>

          <Link href="/" className="font-semibold md:hidden">S4S</Link>
        </div>

        {/* Center: global search */}
        <div className="flex flex-1 items-center justify-center">
          <div className="relative hidden w-full max-w-xl md:block">
            <Input
              placeholder="Search players, entries… (press Enter)"
              className="pl-3"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearchKey}
            />
          </div>
        </div>

        {/* Right cluster: quick actions + notifications + account */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Quick actions (desktop) */}
          <div className="hidden items-center gap-2 md:flex">
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/scout/players/new">
                <UserPlus className="h-4 w-4" />
                Add Player
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/scout/observations/new">
                <NotebookPen className="h-4 w-4" />
                Add Observation
              </Link>
            </Button>
          </div>


        </div>
      </div>
    </header>
  )
}
