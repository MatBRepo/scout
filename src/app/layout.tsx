// app/layout.tsx
import "./globals.css"
import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "S4S Admin",
  description: "Scouting Network",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()
  const dir = ["ar", "he", "fa", "ur"].some((l) => locale.startsWith(l)) ? "rtl" : "ltr"

  return (
    <html lang={locale} dir={dir} key={locale} suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={cn(
          "min-h-dvh overflow-x-hidden bg-background text-foreground antialiased"
        )}
      >
        {/* key={locale} is important so the provider remounts on /en ↔ /pl */}
        <NextIntlClientProvider locale={locale} messages={messages} key={locale}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
