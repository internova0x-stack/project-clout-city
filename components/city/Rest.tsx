"use client";

import { useEffect, useRef, useState } from "react";
import { CITY_ECONOMY } from "@/lib/city";
import { restAvailability, type CityState, type RestKind } from "@/lib/cityState";
import { Sheet } from "../Sheet";
import { EffectChips } from "./Common";

const COPY: Record<RestKind, { title: string; blurb: string; go: string }> = {
  nap: { title: "😴 Take a nap", blurb: "Twenty minutes, they said. Your body heard \"until dinner\".", go: "Nap" },
  sit: { title: "🛋️ Sit a while", blurb: "Phone face down. A rare and powerful move.", go: "Sit down" },
};

/**
 * v0.8 (#26, #27): rest at home. A nap is +30 Energy twice a day, sitting +10 Energy and +6 Mood
 * three times a day (public.rest in migration 0026). The Energy lands at once; the nap's countdown
 * is only the show, on the player's own timer, and Skip ends it.
 */
export function RestSheet({ kind, state, busy, onClose, onRest, onGoHome }: {
  kind: RestKind | null; state: CityState; busy: boolean; onClose: () => void;
  onRest: (kind: RestKind) => Promise<boolean>; onGoHome: () => void;
}) {
  const [napping, setNapping] = useState(false);
  const [lastKind, setLastKind] = useState<RestKind | null>(null);
  if (kind !== lastKind) {
    setLastKind(kind);
    setNapping(false);
  }
  if (!kind) return <Sheet open={false} onClose={onClose} label="Rest">{null}</Sheet>;
  const r = CITY_ECONOMY.rest[kind];
  const av = restAvailability(kind, state);
  const away = (state.player.at_place ?? null) !== null;
  const go = async () => {
    if (!(await onRest(kind))) return;
    if (kind === "nap") setNapping(true);
    else onClose();
  };
  return (
    <Sheet open onClose={onClose} label={COPY[kind].title}>
      {napping ? (
        <NapCountdown seconds={r.seconds} onDone={onClose} />
      ) : (
        <div className="stack-12">
          <div>
            <h2 className="display-md" style={{ margin: 0, paddingRight: 44 }}>{COPY[kind].title}</h2>
            <p className="subtext" style={{ margin: "4px 0 0" }}>{COPY[kind].blurb}</p>
          </div>
          <EffectChips energy={-r.energy} mood={r.mood} />
          <p className="meta" style={{ margin: 0 }}>
            {av.used} of {av.perDay} today · resets at midnight{kind === "nap" ? ` · ${r.seconds} s` : ""}
          </p>
          {away ? (
            <>
              <p className="meta reason" style={{ margin: 0 }}>You&apos;re out. Rest only works at home.</p>
              <button className="btn btn-taxi" onClick={onGoHome}>Go home</button>
            </>
          ) : (
            <>
              {!av.ok && <p className="meta reason" style={{ margin: 0 }}>{av.reason}</p>}
              <button className="btn btn-taxi" disabled={!av.ok || busy} onClick={() => void go()}>
                {busy ? "…" : COPY[kind].go}
              </button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

function NapCountdown({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState(seconds);
  const done = useRef(false);
  const finish = () => { if (!done.current) { done.current = true; onDone(); } };
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => {
      const l = Math.max(0, seconds - (Date.now() - start) / 1000);
      setLeft(l);
      if (l <= 0) { clearInterval(t); finish(); }
    }, 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);
  const C = 2 * Math.PI * 44;
  return (
    <div className="nap stack-12">
      <svg className="nap-ring" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="44" className="nap-ring-bg" />
        <circle cx="50" cy="50" r="44" className="nap-ring-fg" strokeDasharray={C} strokeDashoffset={C * (left / seconds)} />
        <text x="50" y="50" dominantBaseline="central" textAnchor="middle">💤</text>
      </svg>
      <p className="title" style={{ margin: 0, textAlign: "center" }} aria-live="polite">Napping… {Math.ceil(left)} s</p>
      <button className="btn btn-secondary" onClick={finish}>Skip</button>
    </div>
  );
}
