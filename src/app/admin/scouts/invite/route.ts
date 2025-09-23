import { NextResponse } from "next/server"
import createSSRClient from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export const runtime = "nodejs" // needs Node (service key)
export const dynamic = "force-dynamic"

type Body = {
  email?: string
  full_name?: string
  role?: "scout" | "scout_agent" | "admin"
  is_active?: boolean
}

export async function POST(req: Request) {
  try {
    const ssr = createSSRClient()
    const { data: { user } } = await ssr.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can add users
    const { data: me } = await ssr
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (me?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await req.json()) as Body
    const email = (body.email || "").trim().toLowerCase()
    const full_name = (body.full_name || "").trim()
    const role: Body["role"] = body.role || "scout"
    const is_active = body.is_active ?? true

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
    }
    if (!["scout", "scout_agent", "admin"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
    }

    const admin = createAdminClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1) Send invite (magic link)
    const { data: invite, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name },
        // You could pass app URL redirect here if needed:
        // redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
      })

    if (inviteError) {
      // 409 if already exists, etc.
      return NextResponse.json({ error: inviteError.message }, { status: 400 })
    }
    const newUser = invite.user
    if (!newUser) {
      return NextResponse.json({ error: "Invite created but no user returned" }, { status: 500 })
    }

    // 2) Upsert profile with chosen role + meta
    const { error: upsertErr } = await admin
      .from("profiles")
      .upsert(
        {
          id: newUser.id,
          full_name: full_name || null,
          role,
          is_active,
          // Optional: copy some metadata (agency/country) here if you add fields to the form
        },
        { onConflict: "id" }
      )

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, user_id: newUser.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 })
  }
}
