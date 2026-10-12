import { GameShell } from "@/components/GameShell";
import { getClique, requirePlayer } from "@/lib/player";
import { attendFirstParty, finishHandoff, setMusicMuted, setTutorialState } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Home · Clout City" };

export default async function HomePage() {
  const { player } = await requirePlayer();
  const clique = await getClique();
  return <GameShell player={player} clique={clique} actions={{ setTutorialState, attendFirstParty, finishHandoff, setMusicMuted }} />;
}
