"use client";

// /preview/cutscene (development only): every cutscene (components/cutscene) with sample avatars.
// ?scene=arrival|party|official (default official), ?shot=N starts at that shot, ?capture=1 for recording.
import { useMemo, useState } from "react";
import { CutscenePlayer } from "../cutscene/CutscenePlayer";
import { arrivalScript, officialScript, partnerCast, partyScript, type Cast } from "../cutscene/scripts";
import { DEFAULT_LOOK, HAIR_COLORS, SKIN_TONES, type Look } from "@/lib/look";

export function Cutscene({ startShot = 0, scene = "official" }: { startShot?: number; scene?: string }) {
  const [run, setRun] = useState(0);
  const you: Cast = { look: { ...DEFAULT_LOOK, body: "curvy", build: "curvy", skin: SKIN_TONES[4], hair: "long", hairColor: HAIR_COLORS[1], covering: "none", style: "influencer_soft_glam" } as Look, name: "You" };
  const script = useMemo(() => scene === "arrival" ? arrivalScript(you) : scene === "party" ? partyScript(you)
    : officialScript(you, { ...partnerCast({ name: "@marco.qns", style: "bodega_drip" }, "curvy"), look: { ...DEFAULT_LOOK, body: "straight", build: "athletic", skin: SKIN_TONES[2], hair: "short", hairColor: HAIR_COLORS[0], covering: "none", style: "bodega_drip" } as Look }),
  [scene, run]); // eslint-disable-line react-hooks/exhaustive-deps
  return <CutscenePlayer key={run} script={script} startAt={script.shots[Math.min(startShot, script.shots.length - 1)].at} onDone={() => setRun((n) => n + 1)} />;
}
