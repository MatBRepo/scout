"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/browser"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Menu,
  PanelLeftClose,
  Shield,
  UserPlus,
  NotebookPen,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Role = "scout" | "admin" | null
type SearchScope = "players" | "entries" | "observations" | "notes" | "clubs"

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

const SCOPE_LABEL: Record<SearchScope, string> = {
  players: "Players",
  entries: "Entries",
  observations: "Observations",
  notes: "Notes",
  clubs: "Clubs",
}

const SCOPE_ROUTE: Record<SearchScope, string> = {
  players: "/scout/discover",
  entries: "/scout/entries",
  observations: "/scout/observations",
  notes: "/scout/notes",
  clubs: "/scout/clubs",
}

export function Topbar() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string | null>(null)
  const [role, setRole] = useState<Role>(null)

  // Search
  const [q, setQ] = useState("")
  const [scope, setScope] = useState<SearchScope>("players")
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

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
          .select("full_name, role")
          .eq("id", user.id)
          .maybeSingle()
        if (!mounted) return
        setFullName(p?.full_name ?? null)
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

  const doSearch = () => {
    const term = q.trim()
    if (!term) return
    const base = SCOPE_ROUTE[scope] || "/scout/discover"
    router.push(`${base}?search=${encodeURIComponent(term)}`)
    setMobileSearchOpen(false)
  }

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") doSearch()
  }

  const toggleSidebarMobile = () => window.dispatchEvent(new Event("app:toggle-sidebar"))
  const toggleSidebarCollapse = () => window.dispatchEvent(new Event("app:toggle-collapse"))

  return (
    <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/40">
      {/* Top row */}
      <div className="mx-auto flex h-14  items-center  p-4 md:p-8">
        {/* Left: nav controls + brand */}
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

          <Link href="/" className="font-semibold md:hidden select-none">S4S</Link>
        </div>

        {/* Center: desktop search */}
        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="flex w-full max-w-2xl items-center gap-2">
            <Select value={scope} onValueChange={(v) => setScope(v as SearchScope)}>
              <SelectTrigger className="h-9 w-[150px] shrink-0">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent align="start">
                {Object.entries(SCOPE_LABEL).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1">
              <Input
                placeholder={`Search ${SCOPE_LABEL[scope].toLowerCase()}… (Enter)`}
                className="pl-3 pr-10"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onSearchKey}
                aria-label="Global search"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute right-0 top-0 h-9 w-9"
                onClick={doSearch}
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right: quick actions + role */}
        <div className="ml-auto flex items-center gap-2 md:gap-3">
          {/* Mobile: open search */}
          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            aria-label="Open search"
            onClick={() => setMobileSearchOpen((v) => !v)}
          >
            <Search className="h-5 w-5" />
          </Button>

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

          {/* Role tag (if logged in) */}
          {!loading && (role || email) && (
            <div className="hidden items-center gap-2 sm:flex">
              <RoleBadge role={role} />
              <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                {initials}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Mobile search panel */}
      <div
        className={cn(
          "md:hidden transition-[max-height,opacity] duration-200 ease-out overflow-hidden",
          mobileSearchOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="mx-auto max-w-screen-2xl px-2 pb-2">
          <div className="flex items-center gap-2">
            <Select value={scope} onValueChange={(v) => setScope(v as SearchScope)}>
              <SelectTrigger className="h-10 w-[128px] shrink-0">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent align="start">
                {Object.entries(SCOPE_LABEL).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1">
              <Input
                placeholder={`Search ${SCOPE_LABEL[scope].toLowerCase()}…`}
                className="h-10 pr-10"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onSearchKey}
                aria-label="Global search"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute right-0 top-0 h-10 w-10"
                onClick={doSearch}
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
