"use client";

import dynamic from "next/dynamic";
import { normalizeLook } from "@/lib/look";
import { PLACES } from "@/lib/city";
import { HOME_TEMPLATES, PLACE_TEMPLATES, placeRoom } from "@/lib/rooms";

const Room3D = dynamic(() => import("@/components/room/Room3D"), { ssr: false });

const SIGNS: Record<string, string> = { club: "Velvet Static", cafe: "Grind & Gossip Café", counter: "Lucky Seven Deli" };

// Development previews only: one room on its own, to compare lighting moods.
export function PreviewRoom({ room, daytime, mood }: { room: string; daytime: boolean; mood: "natural" | "dream" }) {
  // ?room=<place id> shows that place's own room (v0.11), with its sign and actions.
  const place = PLACES.find((p) => p.id === room);
  const template = (place && placeRoom(place)) ?? (room in PLACE_TEMPLATES ? PLACE_TEMPLATES[room as keyof typeof PLACE_TEMPLATES] : HOME_TEMPLATES[room] ?? HOME_TEMPLATES.astoria_studio);
  const look = normalizeLook({ body: "curvy", skin: "#8D5524", hair: "braids", hairColor: "#14100E", eyes: "#3B2314", glasses: "round", covering: "none" }, "arcade_nerd");
  return (
    <main className="game">
      <Room3D template={template} look={look} daytime={daytime} sign={place?.name ?? SIGNS[room]} rotatable onNpcTap={() => {}} onExit={() => {}} label="Room preview" mood={mood} insetTop={40} insetBottom={40} />
    </main>
  );
}
