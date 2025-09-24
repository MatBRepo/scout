// src/i18n/navigation.tsx
'use client'

import React from 'react'
import NextLink, {type LinkProps} from 'next/link'
import {
  usePathname as useNextPathname,
  useRouter as useNextRouter,
  useSearchParams as useNextSearchParams
} from 'next/navigation'

export {useNextPathname as usePathname, useNextRouter as useRouter, useNextSearchParams as useSearchParams}

export type Locale = 'en' | 'pl'

export function stripLocale(path: string) {
  const m = path.match(/^\/(en|pl)(?=\/|$)/)
  return m ? path.slice(m[0].length) || '/' : path
}

export function withLocale(href: string, locale: Locale) {
  if (!href.startsWith('/')) return href
  const base = stripLocale(href)
  return `/${locale}${base === '/' ? '' : base}`
}

export function getPathname({href, locale}: {href: string; locale: Locale}) {
  return withLocale(href, locale)
}

type Extra = {
  locale?: Locale
  // deprec/unknown props we want to swallow so they don't hit the DOM:
  reloadDocument?: any
} & React.AnchorHTMLAttributes<HTMLAnchorElement>

/** Localized <Link> that prefixes /en or /pl */
export function Link(props: LinkProps & Extra) {
  const {href, locale = 'en', reloadDocument, ...rest} = props as any
  const h = typeof href === 'string' ? withLocale(href, locale) : href
  return <NextLink href={h} {...(rest as any)} />
}
