// pages/scout/players/[id]/edit.tsx
import { GetServerSideProps } from "next";

const UUIDv4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const id = ctx.params?.id as string;

  if (!id || !UUIDv4.test(id)) {
    return { notFound: true };
  }

  // Example fetch:
  // const { player } = await fetchPlayer(id);
  // if (!player) return { notFound: true };

  return { props: { id } };
};

export default function EditPlayer({ id }: { id: string }) {
  return (
    <main style={{ padding: 24 }}>
      <h1>Edit player</h1>
      <p>Player ID: <code>{id}</code></p>
      {/* Render your edit form here */}
    </main>
  );
}
