// app/scout/players/[id]/edit/page.tsx
import { notFound } from "next/navigation";

// Optional: force dynamic if you fetch per-request
export const dynamic = "force-dynamic";

const UUIDv4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function EditPlayerPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  // Guard bad IDs -> 404 (prevents weird paths)
  if (!UUIDv4.test(id)) notFound();

  // TODO: fetch the player (example)
  // const { data: player, error } = await supabaseServerClient
  //   .from('players')
  //   .select('*')
  //   .eq('id', id)
  //   .single();
  // if (error?.code === 'PGRST116') notFound(); // or show a nicer error

  return (
    <main style={{ padding: 24 }}>
      <h1>Edit player</h1>
      <p>Player ID: <code>{id}</code></p>
      {/* Render your edit form here */}
    </main>
  );
}
