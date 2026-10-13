"use client";

import { useEffect, useRef, useState } from "react";
import { CITY_ECONOMY } from "@/lib/city";
import { cookAvailability, restAvailability, type CityState, type RestKind } from "@/lib/cityState";
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
        <Countdown seconds={r.seconds} emoji="💤" label="Napping" onDone={onClose} />
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

/**
 * v0.8 (spec section 6): the kitchen. The fridge's contents and Cook a meal (+25 Energy, one meal,
 * a 6-second countdown that's only the show). An empty fridge points to the supermarket.
 */
export function KitchenSheet({ open, state, busy, store, onClose, onCook, onGoHome, onGoShopping }: {
  open: boolean; state: CityState; busy: boolean; store: { name: string; miles: string } | null; onClose: () => void;
  onCook: () => Promise<boolean>; onGoHome: () => void; onGoShopping: () => void;
}) {
  const [cooking, setCooking] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setCooking(false);
  }
  const { fridgeMax, cook } = CITY_ECONOMY.groceries;
  const meals = state.player.fridge_meals ?? 0;
  const away = (state.player.at_place ?? null) !== null;
  const av = cookAvailability(state);
  const go = async () => { if (await onCook()) setCooking(true); };
  return (
    <Sheet open={open} onClose={onClose} label="Your kitchen">
      {cooking ? (
        <Countdown seconds={cook.seconds} emoji="🍳" label="Cooking" onDone={onClose} />
      ) : (
        <div className="stack-12">
          <div>
            <h2 className="display-md" style={{ margin: 0, paddingRight: 44 }}>🍳 Your kitchen</h2>
            <p className="subtext" style={{ margin: "4px 0 0" }}>
              {meals ? "Home cooking: cheaper than eating out. Nobody will ever know, which is the downside." : "The fridge light comes on to show you nothing."}
            </p>
          </div>
          <div className="fridge">
            <span className="fridge-icon" aria-hidden="true">🧊</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>Fridge · {meals ? `${meals} of ${fridgeMax} meals` : "empty"}</b>
              {meals ? (
                <span className="fridge-meter" aria-hidden="true">
                  {Array.from({ length: fridgeMax }, (_, i) => <i key={i} className={i < meals ? "on" : ""} />)}
                </span>
              ) : store && <small>{store.name} sells groceries · {store.miles}</small>}
            </div>
          </div>
          {meals > 0 && (
            <>
              <span className="fx-row">
                <span className="fx">⚡ +{cook.energy}</span>
                <span className="fx">🧊 −1 meal</span>
                <span className="fx">⏱ {cook.seconds} s</span>
              </span>
              <p className="meta" style={{ margin: 0 }}>No clout · no daily cap, just what&apos;s in the fridge</p>
            </>
          )}
          {away ? (
            <>
              <p className="meta reason" style={{ margin: 0 }}>You&apos;re out. Cooking only works at home.</p>
              <button className="btn btn-taxi" onClick={onGoHome}>Go home</button>
            </>
          ) : !meals ? (
            <button className="btn btn-taxi" disabled={!store} onClick={onGoShopping}>Go shopping</button>
          ) : (
            <>
              {!av.ok && <p className="meta reason" style={{ margin: 0 }}>{av.reason}</p>}
              <button className="btn btn-taxi" disabled={!av.ok || busy} onClick={() => void go()}>{busy ? "…" : "Cook a meal"}</button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Countdown({ seconds, emoji, label, onDone }: { seconds: number; emoji: string; label: string; onDone: () => void }) {
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
        <text x="50" y="50" dominantBaseline="central" textAnchor="middle">{emoji}</text>
      </svg>
      <p className="title" style={{ margin: 0, textAlign: "center" }} aria-live="polite">{label}… {Math.ceil(left)} s</p>
      <button className="btn btn-secondary" onClick={finish}>Skip</button>
    </div>
  );
}
