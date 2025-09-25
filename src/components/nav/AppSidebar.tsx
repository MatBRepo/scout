'use client'

import React, {useEffect, useState, useCallback} from 'react'
import Image from 'next/image'

import {Link, usePathname} from '@/i18n/navigation'
import {useTranslations, useLocale} from 'next-intl'

import {createClient} from '@/lib/supabase/browser'
import {cn} from '@/lib/utils'

import SignOutButton from '@/components/auth/SignOutButton'
import LanguageToggle from '@/components/i18n/LanguageToggle'
import SettingsDialog from '@/components/settings/SettingsDialog'

import {
  X, Sun, Moon,
  UserCircle2, Compass, PlusCircle,
  Shield, Users, ListChecks, Database,
  Bell, UserRound, Settings, LogOut,
  Binoculars, Table
} from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import {Button} from '@/components/ui/button'

type Role = 'scout' | 'scout_agent' | 'admin'

/* ---------------- Theme Toggle ---------------- */
function ThemeToggle({className}: {className?: string}) {
  const t = useTranslations()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
    const prefersDark =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    const initial = (stored === 'dark' || (!stored && prefersDark)) ? 'dark' : 'light'
    setTheme(initial)
    document.documentElement.classList.toggle('dark', initial === 'dark')
  }, [])

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.classList.toggle('dark', next === 'dark')
      localStorage.setItem('theme', next)
      return next
    })
  }, [])

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm hover:bg-muted',
        className
      )}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">
        {theme === 'dark' ? t('theme.light') : t('theme.dark')}
      </span>
    </button>
  )
}

/* ---------------- Reusable Nav Item (locale-aware active) ---------------- */
function NavItem({
  href, label, icon, onClick, collapsed = false
}: {
  href: string
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  collapsed?: boolean
}) {
  const pathname = usePathname()
  const locale = useLocale() as 'en' | 'pl'

  const normalized = (pathname || '/').replace(/^\/(en|pl)(?=\/|$)/, '') || '/'
  const active = normalized === href || normalized.startsWith(href + '/')

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition',
        collapsed && 'justify-center',
        active ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted'
      )}
      title={collapsed ? label : undefined}
      aria-label={`${label} (${locale})`}
    >
      <span className={cn('grid place-items-center rounded-md p-1', active ? 'text-primary' : 'text-muted-foreground')}>
        {icon}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}

function SectionHeader({children, collapsed = false}: {children: React.ReactNode; collapsed?: boolean}) {
  if (collapsed) return null
  return (
    <div className="px-3 pt-4 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      {children}
    </div>
  )
}
function Divider() {
  return <div className="my-2 h-px w-full bg-border" />
}

/* ---------------- Bottom: Account + Notifications ---------------- */
function RoleBadge({role}: {role: Role | null}) {
  const t = useTranslations()
  if (!role) return null
  const label = role === 'admin' ? t('roles.admin') : role === 'scout_agent' ? t('roles.agent') : t('roles.scout')
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
        role === 'admin' ? 'border-primary/40 text-primary' : 'text-muted-foreground'
      )}
      title={label}
    >
      <Shield className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

type RecentItem = { id: string; title: string; href?: string; ts?: string }

function NotificationsDropdown({
  recent,
  collapsed
}: {
  recent: RecentItem[]
  collapsed: boolean
}) {
  const t = useTranslations()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          className={cn('relative w-full justify-start', collapsed && 'w-9')}
          title={t('notifications.title')}
          aria-label={t('notifications.title')}
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 inline-block h-2 w-2 rounded-full bg-primary" />
          {!collapsed && <span className="ml-2 text-xs">{t('notifications.title')}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align={collapsed ? 'start' : 'end'} className="w-72">
        <DropdownMenuLabel>{t('notifications.recent')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {recent.length === 0 && (
          <div className="px-2 py-6 text-center text-xs text-muted-foreground">
            {t('notifications.empty')}
          </div>
        )}
        {recent.map((r) => (
          <DropdownMenuItem key={r.id} asChild>
            {r.href ? (
              <Link href={r.href} className="w-full">
                <div className="flex flex-col">
                  <span className="text-sm">
                    {t('recent.observation', {title: r.title || t('misc.untitled')})}
                  </span>
                  {r.ts && <span className="text-[11px] text-muted-foreground">{r.ts}</span>}
                </div>
              </Link>
            ) : (
              <div className="flex flex-col">
                <span className="text-sm">
                  {t('recent.observation', {title: r.title || t('misc.untitled')})}
                </span>
                {r.ts && <span className="text-[11px] text-muted-foreground">{r.ts}</span>}
              </div>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AccountDropdown({
  collapsed,
  loading,
  fullName,
  email,
  avatarUrl,
  role,
  canDiscover,
  onOpenSettings
}: {
  collapsed: boolean
  loading: boolean
  fullName: string | null
  email: string | null
  avatarUrl: string | null
  role: Role | null
  canDiscover: boolean
  onOpenSettings?: () => void
}) {
  const t = useTranslations()
  const initials =
    (fullName?.trim()?.split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') ||
      email?.[0]?.toUpperCase() ||
      'U')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-10 w-full items-center gap-2 px-2',
            collapsed && 'h-9 w-9 justify-center p-0'
          )}
          title={t('account.title')}
          aria-label={t('account.title')}
        >
          {loading ? (
            <div className="h-7 w-7 animate-pulse rounded-full bg-muted" />
          ) : avatarUrl ? (
            <Image src={avatarUrl} alt="Avatar" width={28} height={28} className="rounded-full border" />
          ) : (
            <div className="grid h-7 w-7 place-items-center rounded-full border bg-muted text-[11px] font-semibold">
              {initials}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 text-left">
              <div className="line-clamp-1 text-xs font-medium">{fullName ?? email ?? 'User'}</div>
              <div className="text-[11px] text-muted-foreground">
                <RoleBadge role={role} />
              </div>
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align={collapsed ? 'start' : 'end'} className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <UserRound className="h-4 w-4" />
          {t('account.title')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild><Link href="/scout/my-players">{t('nav.myPlayers')}</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/scout/observations">{t('nav.observations')}</Link></DropdownMenuItem>

        {canDiscover && (
          <>
            <DropdownMenuItem asChild><Link href="/scout/discover">{t('nav.discover')}</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/scout/discover/with-agent">— {t('nav.discoverPlayers.withAgent')}</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/scout/discover/without-agent">— {t('nav.discoverPlayers.withoutAgent')}</Link></DropdownMenuItem>
          </>
        )}

        <DropdownMenuItem asChild><Link href="/scout/players/new">{t('nav.addPlayer')}</Link></DropdownMenuItem>

        {role === 'admin' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2 text-primary">
              <Shield className="h-4 w-4" />
              {t('roles.admin')}
            </DropdownMenuLabel>
            <DropdownMenuItem asChild><Link href="/admin">Dashboard</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/admin/players">{t('nav.admin.allPlayers')}</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/admin/scouts">{t('nav.admin.scouts')}</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/admin/duplicates">{t('nav.admin.duplicates')}</Link></DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => { e.preventDefault(); onOpenSettings?.() }}
          className="cursor-pointer"
        >
          <Settings className="mr-2 h-4 w-4" />
          {t('ui.settings')}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <div className="px-2 pb-1 pt-1.5">
          <SignOutButton className="w-full justify-start gap-2" icon={<LogOut className="h-4 w-4" />}>
            {t('ui.signOut')}
          </SignOutButton>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ---------------- Sidebar ---------------- */
export function AppSidebar() {
  const t = useTranslations()
  const supabase = createClient()

  const [role, setRole] = useState<Role | null>(null)
  const [collapsed, setCollapsed] = useState<boolean>(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [loadingAcct, setLoadingAcct] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const [recent, setRecent] = useState<RecentItem[]>([])

  useEffect(() => {
    const stored = localStorage.getItem('sidebar:collapsed')
    if (stored === 'true') setCollapsed(true)

    ;(async () => {
      const {data: userRes} = await supabase.auth.getUser()
      const uid = userRes.user?.id
      if (!uid) {
        setLoadingAcct(false)
        return
      }

      const {data: p} = await supabase
        .from('profiles')
        .select('role, full_name, avatar_url')
        .eq('id', uid)
        .single()

      if (p?.role) setRole(p.role as Role)
      setFullName(p?.full_name ?? null)
      setAvatarUrl(p?.avatar_url ?? null)
      setEmail(userRes.user?.email ?? null)

      const {data: sessions} = await supabase
        .from('observation_sessions')
        .select('id, title, created_at')
        .eq('scout_id', uid)
        .order('created_at', {ascending: false})
        .limit(6)

      const items: RecentItem[] = (sessions ?? []).map((row: any) => ({
        id: `sess-${row.id}`,
        title: row.title || '',
        href: `/scout/observations/${row.id}`,
        ts: row.created_at ? new Date(row.created_at).toLocaleString() : undefined
      }))
      setRecent(items)
      setLoadingAcct(false)
    })()

    const open = () => setMobileOpen(true)
    const close = () => setMobileOpen(false)
    const toggle = () => setMobileOpen(prev => !prev)
    const toggleCollapse = () => {
      setCollapsed(prev => {
        const next = !prev
        localStorage.setItem('sidebar:collapsed', String(next))
        return next
      })
    }
    window.addEventListener('app:open-sidebar', open as EventListener)
    window.addEventListener('app:close-sidebar', close as EventListener)
    window.addEventListener('app:toggle-sidebar', toggle as EventListener)
    window.addEventListener('app:toggle-collapse', toggleCollapse as EventListener)

    return () => {
      window.removeEventListener('app:open-sidebar', open as EventListener)
      window.removeEventListener('app:close-sidebar', close as EventListener)
      window.removeEventListener('app:toggle-sidebar', toggle as EventListener)
      window.removeEventListener('app:toggle-collapse', toggleCollapse as EventListener)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lock background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      const original = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = original }
    }
  }, [mobileOpen])

  const closeMobile = () => setMobileOpen(false)
  const canDiscover = role === 'scout_agent' || role === 'admin'

  const ScoutBlock = (
    <>
      <SectionHeader collapsed={collapsed}>{t('sections.scout')}</SectionHeader>
      <nav className="space-y-1">
        <NavItem collapsed={collapsed} href="/scout/my-players" label={t('nav.myPlayers')} icon={<UserCircle2 className="h-4 w-4" />} onClick={closeMobile} />
        <NavItem collapsed={collapsed} href="/scout/observations" label={t('nav.observations')} icon={<Binoculars className="h-4 w-4" />} onClick={closeMobile} />

        {canDiscover && (
          <>
            <NavItem collapsed={collapsed} href="/scout/discover" label={t('nav.discover')} icon={<Compass className="h-4 w-4" />} onClick={closeMobile} />
            <div className={cn('ml-7', collapsed && 'hidden')}>
              <NavItem collapsed={false} href="/scout/discover/with-agent" label={t('nav.discoverPlayers.withAgent')} icon={<Users className="h-4 w-4" />} onClick={closeMobile} />
              <NavItem collapsed={false} href="/scout/discover/without-agent" label={t('nav.discoverPlayers.withoutAgent')} icon={<Users className="h-4 w-4" />} onClick={closeMobile} />
            </div>
          </>
        )}

        <NavItem collapsed={collapsed} href="/scout/players/new" label={t('nav.addPlayer')} icon={<PlusCircle className="h-4 w-4" />} onClick={closeMobile} />
      </nav>
    </>
  )

  const AdminBlock = role === 'admin' && (
    <>
      {!collapsed && <Divider />}
      <SectionHeader collapsed={collapsed}>{t('sections.admin')}</SectionHeader>
      <nav className="space-y-1">
        <NavItem collapsed={collapsed} href="/admin/players" label={t('nav.admin.allPlayers')} icon={<Users className="h-4 w-4" />} onClick={closeMobile} />
        <NavItem collapsed={collapsed} href="/admin/duplicates" label={t('nav.admin.duplicates')} icon={<ListChecks className="h-4 w-4" />} onClick={closeMobile} />
        <NavItem collapsed={collapsed} href="/admin/scouts" label={t('nav.admin.scouts')} icon={<Shield className="h-4 w-4" />} onClick={closeMobile} />

        <NavItem collapsed={collapsed} href="/admin/scraper" label={t('nav.admin.scraper')} icon={<Database className="h-4 w-4" />} onClick={closeMobile} />
        <div className={cn('ml-7', collapsed && 'hidden')}>
          <NavItem collapsed={false} href="/admin/scraper/data" label={t('nav.admin.scraperData')} icon={<Table className="h-4 w-4" />} onClick={closeMobile} />
        </div>
      </nav>
    </>
  )

  const BottomBlock = (
    <div className={cn('border-t p-3', collapsed && 'px-2')}>
      <div className={cn('flex items-center gap-2', collapsed && 'justify-center')}>
        <NotificationsDropdown recent={recent} collapsed={collapsed} />
      </div>
      <div className="mt-2">
        <AccountDropdown
          collapsed={collapsed}
          loading={loadingAcct}
          fullName={fullName}
          email={email}
          avatarUrl={avatarUrl}
          role={role}
          canDiscover={canDiscover}
          onOpenSettings={() => {
            setSettingsOpen(true)
            setMobileOpen(false)
          }}
        />
      </div>
      {/* Keep toggles only at the bottom */}
      {!collapsed && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      )}
      {collapsed && (
        <div className="mt-2 flex items-center justify-center gap-2">
          <LanguageToggle collapsed />
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Spacer to keep main content pushed right when sidebar is fixed */}
      <div aria-hidden className="hidden md:block" style={{width: collapsed ? 64 : 270}} />

      {/* Desktop aside (fixed + collapsible) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden md:flex flex-col border-r bg-background transition-[width] duration-200',
          collapsed ? 'w-16' : 'w-[270px]'
        )}
      >
        <div className={cn('flex-1 overflow-y-auto', collapsed ? 'px-2 pt-4' : 'p-4')}>
          <div className={cn('flex items-center justify-between', collapsed && 'justify-center')}>
            {collapsed ? (
              <Link href="/" className="font-extrabold text-lg" title={t('brand.title')}>S4S</Link>
            ) : (
              <div className="min-w-0">
                <Link href="/" className="font-bold text-lg">{t('brand.title')}</Link>
                <p className="text-xs text-muted-foreground">{t('brand.subtitle')}</p>
              </div>
            )}
          </div>

          {ScoutBlock}
          {AdminBlock}
        </div>

        {BottomBlock}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={closeMobile} />

          {/* Drawer */}
          <div className="absolute inset-y-0 left-0 w-80 max-w-[90%] bg-background border-r shadow-xl flex h-[100dvh] flex-col overscroll-contain">
            {/* Scrollable content (header + nav) */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
                <div className="flex items-center justify-between">
                  <div>
                    <Link href="/" onClick={closeMobile} className="font-bold text-lg">{t('brand.title')}</Link>
                    <p className="text-xs text-muted-foreground">{t('brand.subtitle')}</p>
                  </div>
                  <button
                    className="inline-flex items-center justify-center rounded-md border p-2 hover:bg-muted"
                    onClick={closeMobile}
                    aria-label={t('ui.close')}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <Divider />
                {ScoutBlock}
                {AdminBlock}
              </div>
            </div>

            {/* Sticky bottom (account + toggles) with safe-area */}
            <div className="sticky bottom-0 bg-background pb-[env(safe-area-inset-bottom)]">
              {BottomBlock}
            </div>
          </div>
        </div>
      )}

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}

export default AppSidebar
