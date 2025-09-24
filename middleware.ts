// middleware.ts
import {NextRequest, NextResponse} from 'next/server'
import {createServerClient, type CookieOptions} from '@supabase/ssr'
import createMiddleware from 'next-intl/middleware'
import {routing} from '@/i18n/routing'

export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] }

// Public routes (use *unprefixed* paths here; we strip the locale below)
const PUBLIC = new Set([
  '/',
  '/login',
  '/auth/callback',
  '/forgot-password',
  '/reset-password',
  '/signup'
])

const stripLocale = (p: string) => p.replace(/^\/(en|pl)(?=\/|$)/, '') || '/'
const getLocaleFromPath = (p: string): 'en' | 'pl' =>
  (p.match(/^\/(en|pl)(?=\/|$)/)?.[1] as 'en' | 'pl') ?? 'en'

// NOTE: With next-intl v3, just pass *one* arg (routing or config object).
const handleI18nRouting = createMiddleware(routing)

export async function middleware(req: NextRequest) {
  // Let next-intl normalize /en|pl prefixes & set NEXT_LOCALE cookie
  const res = handleI18nRouting(req)

  // Attach Supabase cookie helpers to the same response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies: {name: string; value: string; options: CookieOptions}[]) => {
          cookies.forEach(({name, value, options}) =>
            res.cookies.set({name, value, ...options})
          )
        }
      }
    }
  )

  // Auth gate on *unprefixed* path
  const pathname = req.nextUrl.pathname
  const rest = stripLocale(pathname)
  const locale = getLocaleFromPath(pathname)
  const isPublic = PUBLIC.has(rest)

  const {data: {user}} = await supabase.auth.getUser()

  if (!user && !isPublic) {
    const url = req.nextUrl.clone()
    url.pathname = `/${locale}/login`
    url.searchParams.set('redirect_to', pathname + req.nextUrl.search)
    return NextResponse.redirect(url)
  }

  if (user && rest === '/login') {
    const url = req.nextUrl.clone()
    url.pathname = `/${locale}/scout/my-players`
    return NextResponse.redirect(url)
  }

  return res
}
