// app/scout/players/[id]/edit/page.tsx
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

type Params = { id: string }

const UUIDv4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function EditPlayerPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { id } = await params

  // Guard bad IDs -> 404 (prevents weird paths)
  if (!UUIDv4.test(id)) notFound()

  // TODO: fetch the player (example)
  // const supabase = await createClient()
  // const { data: player, error } = await supabase
  //   .from("players")
  //   .select("*")
  //   .eq("id", id)
  //   .maybeSingle()
  // if (!player) notFound()

  return (
    <main style={{ padding: 24 }}>
      <h1>Edit player</h1>
      <p>
        Player ID: <code>{id}</code>
      </p>
      {/* Render your edit form here */}
    </main>
  )
}
