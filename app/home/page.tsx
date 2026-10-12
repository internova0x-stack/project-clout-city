import { GameShell } from "@/components/GameShell";
import { getClique, requirePlayer } from "@/lib/player";

export const dynamic = "force-dynamic";

export const metadata = { title: "Home · Clout City" };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { player } = await requirePlayer();
  const clique = await getClique();
  const params = await searchParams;
  return <GameShell player={player} clique={clique} firstVisit={params.welcome === "1"} />;
}
