// src/i18n/routing.ts
import {defineRouting} from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'pl'],
  defaultLocale: 'en',
  // Force explicit prefix so /pl/... is always honored
  localePrefix: 'always'
})
