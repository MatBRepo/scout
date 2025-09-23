import { NextResponse } from "next/server"
export async function POST(req: Request) {
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
  return NextResponse.json({ ok: true, id })
}
