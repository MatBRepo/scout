// middleware.ts at project root
import { NextRequest, NextResponse } from "next/server"
import { createServerClient, type CookieOptions } from "@supabase/ssr"

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"], // don't run on /api or assets
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,        // must be defined
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,   // must be defined
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: "", ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirect_to", req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return res
}
