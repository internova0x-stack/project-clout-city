"use client";

// The per-device graphics switches (lib/graphics.ts): Settings' "Low graphics" for everyone and the Studio's
// "Preview the new bodies" for admins. Both apply the next time a 3D screen opens.

import { useEffect, useState } from "react";
import { lowGraphics, newBodies, setLowGraphics, setNewBodies } from "@/lib/graphics";
import { Toggle } from "./Toggle";

export function GraphicsSwitch({ kind, onToast }: { kind: "low" | "bodies"; onToast?: (t: string) => void }) {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => { setOn(kind === "low" ? lowGraphics() : newBodies()); }, [kind]);
  const flip = () => {
    const next = !on;
    if (kind === "low") setLowGraphics(next); else setNewBodies(next);
    setOn(next);
    onToast?.(kind === "low"
      ? next ? "Low graphics on. Rooms and avatars go easy on your phone from the next screen." : "Full graphics back on from the next screen."
      : next ? "New bodies on for this device. Open the game to see them." : "Back to the current bodies on this device.");
  };
  const [title, meta] = kind === "low"
    ? ["Low graphics", "Simpler 3D for older phones: no shadows, lighter avatars"]
    : ["Preview the new bodies", "On this device only"];
  return (
    <div className="list-row static">
      <span style={{ flex: 1 }}><span className="title" style={{ display: "block" }}>{title}</span><span className="meta">{meta}</span></span>
      <Toggle on={!!on} label={title} disabled={on === null} onChange={flip} />
    </div>
  );
}
