// app/scout/layout.tsx
import type {ReactNode} from 'react'
import {getLocale} from 'next-intl/server'
import {AppSidebar} from '@/components/nav/AppSidebar'
import {Topbar} from '@/components/nav/Topbar'

export default async function ScoutLayout({children}: {children: ReactNode}) {
  const locale = await getLocale() // server-safe

  return (
    // key={locale} ensures client components under here re-render on locale switch
    <div key={locale} className="min-h-dvh flex">
      <AppSidebar />

      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="p-4 md:p-8 bg-gradient-to-br from-primary/10 via-muted to-background">{children}</main>
      </div>
    </div>
  )
}
