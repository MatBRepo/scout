// app/layout.tsx
import './globals.css'
import type {Metadata} from 'next'
import {NextIntlClientProvider} from 'next-intl'
import {getLocale, getMessages} from 'next-intl/server'
import {cn} from '@/lib/utils'

export const metadata: Metadata = {
  title: 'S4S Admin',
  description: 'Scouting Network'
}

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const locale = await getLocale()
  const messages = await getMessages()

// app/layout.tsx
return (
  <html lang={locale} key={locale} suppressHydrationWarning>
    <body
      suppressHydrationWarning
      className={cn('min-h-screen bg-background text-foreground antialiased')}
    >
      <NextIntlClientProvider locale={locale} messages={messages} key={locale}>
        {children}
      </NextIntlClientProvider>
    </body>
  </html>
)

}
