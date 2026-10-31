"use client";

import { useCallback, useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { GALA, galaClout, type GalaApi, type GalaState } from "@/lib/gala";

// The Charity Gala (the underworld, part 2; migration 0150): the Halo end's own night at Ditmars Heights Rooftop. On the
// list: pick a gift, once a New York week; off it: who gets in, said the city's way. The database decides.

const cs = (n: number) => `C$${n.toLocaleString("en-US")}`;

export function GalaSheet({ open, onClose, api, here, onToast, onChanged }: {
  open: boolean;
  onClose: () => void;
  api: GalaApi;
  /** The player is on the rooftop. */
  here: boolean;
  onToast: (text: string) => void;
  onChanged: () => void;
}) {
  const [s, setS] = useState<GalaState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<number | null>(null);
  const load = useCallback(async () => {
    const r = await api.state();
    if (r.ok) { setS(r.data); setError(null); } else setError(r.error);
  }, [api]);
  useEffect(() => { if (open) { setPick(null); void load(); } }, [open, load]);
  const give = async () => {
    if (!pick) return;
    setBusy(true);
    const r = await api.donate(pick);
    setBusy(false);
    if (!r.ok) { onToast(r.error); return; }
    onToast(`🥂 ${cs(pick)} to the Astoria Literacy & Rooftop Garden Fund. +${r.data.clout} 🔥, +${r.data.mood} Mood. The committee will mention you in calligraphy.`);
    onChanged();
    void load();
  };
  return (
    <Sheet open={open} onClose={onClose} label="The Charity Gala">
      <div className="stack-16">
        <div className="gala-poster stack-8">
          <p className="overline">🥂 Ditmars Heights Rooftop · every week</p>
          <h2 className="display-lg" style={{ margin: 0 }}>The Charity Gala</h2>
          <p className="subtext" style={{ margin: 0 }}>
            String lights, a jazz trio, tiny food on big plates. Everyone here volunteers at something, and everyone mentions it.
            The money goes to the Astoria Literacy &amp; Rooftop Garden Fund, which is real in this city.
          </p>
        </div>
        {!s && !error && <p className="meta">Checking the guest list…</p>}
        {error && <p className="error-text">{error}</p>}
        {s && !s.invited && (
          <div className="card stack-8">
            <p className="title" style={{ margin: 0 }}>📋 Not on the list</p>
            <p className="subtext" style={{ margin: 0 }}>
              {s.revealed
                ? "The woman with the clipboard smiles the way people smile at a parking ticket. The list is for people known for doing good around the city. Keep at it."
                : "The woman with the clipboard has never heard of you. The list is for people the city knows as good eggs. Make a few choices around town first."}
            </p>
          </div>
        )}
        {s?.invited && s.donated !== null && (
          <div className="card stack-8">
            <p className="title" style={{ margin: 0 }}>💌 You gave {cs(s.donated)} this week</p>
            <p className="subtext" style={{ margin: 0 }}>Your name is on the donor board, slightly bigger than it needs to be. Come back next week.</p>
          </div>
        )}
        {s?.invited && s.donated === null && (
          <div className="card stack-12">
            <p className="title" style={{ margin: 0 }}>✨ You&apos;re on the list</p>
            {!here && <p className="meta" style={{ margin: 0 }}>Gifts are made in person, on the rooftop.</p>}
            <div className="choice-options" role="radiogroup" aria-label="Your gift">
              {s.amounts.map((a) => (
                <button key={a} role="radio" aria-checked={pick === a} className="choice-opt" disabled={busy || !here} onClick={() => setPick(a)}>
                  <span className="choice-opt-row"><span className="choice-opt-label">Give {cs(a)}</span></span>
                  {pick === a && <span className="choice-opt-more"><span><b>You get</b> +{galaClout(a)} 🔥, +{GALA.mood} Mood, a handshake</span><span><b>It costs</b> {cs(a)}</span></span>}
                </button>
              ))}
            </div>
            <button className="btn btn-taxi" disabled={busy || !here || !pick} onClick={() => void give()}>Make the gift</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
