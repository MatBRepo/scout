Scout — modern football scouting notebook

A Next.js + Supabase app for player discovery, notes, voice memos, and observation sessions. Clean UI (shadcn/ui), RLS-safe server code, optional OpenAI Whisper transcription, and handy Transfermarkt helpers.

✨ Features

Auth: magic link + Google (Supabase Auth)

My Players: personal list with search/sort, table/grid view, soft delete (Trash) & restore

Observation Sessions: add players to sessions; quick membership overview

Notes: category-based ratings & comments with autosave; quick insights draft

Voice Notes: upload short clips; optional server-side transcription via Whisper

Transfermarkt: microservice fetch & lightweight scrapers + caching

Admin: invite scouts, manage roles, profile editing

RLS-friendly: SSR & API routes use a safe Supabase client with cookie passthrough

UI/UX: shadcn/ui, Tailwind, Lucide icons, toasts via sonner

🧱 Tech stack

Next.js App Router (React, TypeScript)

Supabase (Postgres, Auth, Storage, RLS)

Tailwind + shadcn/ui

OpenAI Whisper (optional for server transcription)

Cheerio for HTML parsing (TM helpers)


🙏 Acknowledgements

Next.js, Supabase, shadcn/ui, Tailwind, Lucide, sonner, OpenAI Whisper, and the Transfermarkt community.