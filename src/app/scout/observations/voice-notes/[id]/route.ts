// src/app/scout/observations/voice-notes/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function supabaseFromCookies() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    }
  )
}

// PATCH /scout/observations/voice-notes/:id
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params?.id
  if (!id) return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 })

  try {
    const supabase = supabaseFromCookies()

    // auth
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) return NextResponse.json({ ok: false, error: "not authenticated" }, { status: 401 })

    // fetch note
    const { data: note, error: selErr } = await supabase
      .from("observation_voice_notes")
      .select("id, scout_id, storage_path, language")
      .eq("id", id)
      .single()
    if (selErr) return NextResponse.json({ ok: false, error: selErr.message }, { status: 404 })
    if (note.scout_id !== user.id) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })

    // read body (may contain transcript from browser)
    let body: any = {}
    try { body = await req.json() } catch {}
    const incomingTranscript = (body?.transcript ?? "").toString().trim()
    const language = (body?.language ?? note.language ?? null) as string | null

    // 1) If client provided transcript, save it immediately (no OpenAI).
    if (incomingTranscript) {
      const { error: updErr } = await supabase
        .from("observation_voice_notes")
        .update({ transcript: incomingTranscript, language, status: "done" })
        .eq("id", id)
      if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 })
      return NextResponse.json({ ok: true, transcript: incomingTranscript })
    }

    // 2) Otherwise, try server transcription only if explicitly enabled.
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY
    const CAN_SERVER_TRANSCRIBE = !!OPENAI_API_KEY // only OpenAI path implemented here
    if (!CAN_SERVER_TRANSCRIBE) {
      return NextResponse.json(
        { ok: false, error: "Server transcription disabled" },
        { status: 501 }
      )
    }

    // mark as transcribing
    await supabase.from("observation_voice_notes").update({ status: "transcribing" }).eq("id", id)

    // signed URL to audio
    const { data: signed, error: signErr } = await supabase
      .storage.from("obs-audio")
      .createSignedUrl(note.storage_path, 60)
    if (signErr || !signed?.signedUrl) {
      await supabase.from("observation_voice_notes").update({ status: "error" }).eq("id", id)
      return NextResponse.json({ ok: false, error: signErr?.message || "signed URL failed" }, { status: 400 })
    }

    const audioRes = await fetch(signed.signedUrl)
    if (!audioRes.ok) {
      await supabase.from("observation_voice_notes").update({ status: "error" }).eq("id", id)
      return NextResponse.json({ ok: false, error: `download failed: ${audioRes.status}` }, { status: 502 })
    }
    const arrayBuf = await audioRes.arrayBuffer()
    const blob = new Blob([arrayBuf], { type: audioRes.headers.get("content-type") || "audio/webm" })

    // OpenAI Whisper (only if enabled)
    const form = new FormData()
    form.append("file", blob, "note.webm")
    form.append("model", "whisper-1")
    if (language) form.append("language", language)
    form.append("response_format", "json")

    const aiRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    })

    const ct = aiRes.headers.get("content-type") || ""
    let text = ""
    if (ct.includes("application/json")) {
      const j = await aiRes.json().catch(() => ({}))
      if (!aiRes.ok) {
        await supabase.from("observation_voice_notes").update({ status: "error" }).eq("id", id)
        return NextResponse.json({ ok: false, error: j?.error?.message || `OpenAI error ${aiRes.status}` }, { status: aiRes.status })
      }
      text = j?.text || ""
    } else {
      const raw = await aiRes.text()
      await supabase.from("observation_voice_notes").update({ status: "error" }).eq("id", id)
      return NextResponse.json({ ok: false, error: `OpenAI non-JSON ${aiRes.status}: ${raw.slice(0, 200)}` }, { status: 502 })
    }

    const { error: updErr } = await supabase
      .from("observation_voice_notes")
      .update({ transcript: text, language, status: "done" })
      .eq("id", id)
    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 })

    return NextResponse.json({ ok: true, transcript: text })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "unexpected error" }, { status: 500 })
  }
}


export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params?.id
  if (!id) return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 })
  try {
    const supabase = supabaseFromCookies()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) return NextResponse.json({ ok: false, error: "not authenticated" }, { status: 401 })

    const { data: note, error: selErr } = await supabase
      .from("observation_voice_notes")
      .select("id, scout_id, storage_path")
      .eq("id", id)
      .single()

    if (selErr) return NextResponse.json({ ok: false, error: selErr.message }, { status: 404 })
    if (note.scout_id !== user.id) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })

    await supabase.storage.from("obs-audio").remove([note.storage_path])
    const { error: delErr } = await supabase.from("observation_voice_notes").delete().eq("id", id)
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "unexpected error" }, { status: 500 })
  }
}
