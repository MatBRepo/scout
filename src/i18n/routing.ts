// src/i18n/routing.ts
export const routing = {
  locales: ['en', 'pl'] as const,
  defaultLocale: 'en',
  pathnames: { /* ... */ }
} as const

export type Locale = typeof routing.locales[number]

export function isLocale(l: string): l is Locale {
  return (routing.locales as readonly string[]).includes(l)
}
