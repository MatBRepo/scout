// src/i18n/routing.ts
import {defineRouting} from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'pl'],
  defaultLocale: 'en',
  localePrefix: 'always' // IMPORTANT: /en/... and /pl/... must always be in the URL
})
