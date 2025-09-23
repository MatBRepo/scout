// src/app/actions/auth.ts
"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/") // back to landing after sign-out
}
