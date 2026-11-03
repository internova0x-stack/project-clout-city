"use client";

// Settings → Sounds (owner, Nov 3: the sound kit, lib/sfx.ts): rewards, ticks and celebrations, on this device, apart from
// the music's switch (many people play with the music off and still want the coins).

import { useEffect, useState } from "react";
import { setSfxMuted, sfx, sfxMuted } from "@/lib/sfx";
import { Toggle } from "./Toggle";

export function SoundSwitch() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => { setOn(!sfxMuted()); }, []);
  const flip = () => {
    const next = !on;
    setSfxMuted(!next);
    setOn(next);
    if (next) sfx.coin();
  };
  return (
    <div className="list-row static">
      <span style={{ flex: 1 }}><span className="title" style={{ display: "block" }}>Sounds</span><span className="meta">Coins, ticks and celebrations. The music has its own switch</span></span>
      <Toggle on={!!on} label="Sounds" disabled={on === null} onChange={flip} />
    </div>
  );
}
