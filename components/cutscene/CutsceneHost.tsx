"use client";

// The game's cutscenes, by kind (components/cutscene/scripts.ts), for GameShell to open lazily (this module and three's
// sets download only when one plays).
import { useMemo } from "react";
import { CutscenePlayer } from "./CutscenePlayer";
import { arrivalScript, officialScript, partnerCast, partyScript, type Cast } from "./scripts";

export type CutsceneKind = "arrival" | "party" | "official";
export interface CutsceneRequest { kind: CutsceneKind; partner?: { name: string; style?: string; look?: unknown } | null; onDone?: () => void }

export default function CutsceneHost({ req, you, onClose }: { req: CutsceneRequest; you: Cast; onClose: () => void }) {
  const script = useMemo(() => req.kind === "arrival" ? arrivalScript(you)
    : req.kind === "party" ? partyScript(you)
    : officialScript(you, partnerCast(req.partner, you.look.body === "curvy" ? "curvy" : "straight")), [req]); // eslint-disable-line react-hooks/exhaustive-deps
  return <CutscenePlayer script={script} onDone={() => { onClose(); req.onDone?.(); }} />;
}
