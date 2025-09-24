// src/i18n/request.ts
import {getRequestConfig} from 'next-intl/server'
// import type {AbstractIntlMessages} from 'next-intl'

const SUPPORTED = ['en', 'pl'] as const
type Locale = (typeof SUPPORTED)[number]

export default getRequestConfig(async ({locale}) => {
  const safeLocale: Locale = SUPPORTED.includes(locale as Locale) ? (locale as Locale) : 'en'

  // IMPORTANT: omit the file extension so bundlers can resolve it
  let messages /* : AbstractIntlMessages */ 
  try {
    messages = (await import(`../messages/${safeLocale}`)).default
  } catch {
    messages = (await import(`../messages/en`)).default
  }

  return {
    locale: safeLocale,
    messages
  }
})
