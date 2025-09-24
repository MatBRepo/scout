// src/components/i18n/LanguageToggle.tsx
'use client'

import {usePathname} from '@/i18n/navigation' // only for current path
import {useSearchParams} from 'next/navigation'
import {useLocale} from 'next-intl'
import {cn} from '@/lib/utils'

const stripLocale = (p: string) => p.replace(/^\/(en|pl)(?=\/|$)/, '') || '/'

export default function LanguageToggle({
  collapsed = false,
  className
}: {collapsed?: boolean; className?: string}) {
  const locale = useLocale()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const base = stripLocale(pathname)
  const qs = searchParams.toString()
  const suffix = qs ? `${base}?${qs}` : base

  const hrefEN = `/en${suffix.startsWith('/') ? '' : '/'}${suffix}`
  const hrefPL = `/pl${suffix.startsWith('/') ? '' : '/'}${suffix}`

  const btn = 'inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs hover:bg-muted transition'

  return (
    <div className={cn('inline-flex items-center gap-1 rounded-lg p-0.5 border', className)} role="group" aria-label="Language">
      {/* Plain anchors => guaranteed full navigation */}
      <a href={hrefEN} className={cn(btn, locale==='en' && 'bg-muted font-semibold')} aria-pressed={locale==='en'}>
        <span aria-hidden className="mr-1">🇬🇧</span>{!collapsed && <span>EN</span>}
      </a>
      <a href={hrefPL} className={cn(btn, locale==='pl' && 'bg-muted font-semibold')} aria-pressed={locale==='pl'}>
        <span aria-hidden className="mr-1">🇵🇱</span>{!collapsed && <span>PL</span>}
      </a>
    </div>
  )
}
