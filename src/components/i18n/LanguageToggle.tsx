// src/components/i18n/LanguageToggle.tsx
'use client'

import {useLocale} from 'next-intl'
import {usePathname, useRouter} from '@/i18n/navigation'
import {cn} from '@/lib/utils'

export default function LanguageToggle({
  collapsed = false,
  className
}: {collapsed?: boolean; className?: string}) {
  const locale = useLocale() as 'en' | 'pl'
  const pathname = usePathname() ?? '/'
  const router = useRouter()

  function switchTo(next: 'en' | 'pl') {
    const base = pathname.replace(/^\/(en|pl)(?=\/|$)/, '') || '/'
    const qs = typeof window !== 'undefined' ? window.location.search : ''
    const url = `/${next}${base}${qs}`

    // ensure SSR picks it up too
    document.cookie = `NEXT_LOCALE=${next}; Path=/; Max-Age=31536000`

    router.push(url)
    router.refresh()
  }

  const btn = 'inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs hover:bg-muted transition'

  return (
    <div className={cn('inline-flex items-center gap-1 rounded-lg p-0.5 border', className)} role="group">
      <button
        type="button"
        onClick={() => switchTo('en')}
        className={cn(btn, locale === 'en' && 'bg-muted font-semibold')}
      >
        <span aria-hidden className="mr-1">🇬🇧</span>
        {!collapsed && <span>EN</span>}
      </button>
      <button
        type="button"
        onClick={() => switchTo('pl')}
        className={cn(btn, locale === 'pl' && 'bg-muted font-semibold')}
      >
        <span aria-hidden className="mr-1">🇵🇱</span>
        {!collapsed && <span>PL</span>}
      </button>
    </div>
  )
}
