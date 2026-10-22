"use client";

import { useEffect, useState } from "react";
import { AUTOPILOT_LABEL, type Autopilot, type AutopilotKind } from "@/lib/autopilot";
import type { StudioApi } from "@/lib/studio";
import { Toggle } from "../Toggle";

// Autopilot (migration 0107): one switch per kind of weekly content. On, it goes live by itself; off, it waits for you.

export function AutopilotCard({ api }: { api: StudioApi }) {
  const [auto, setAuto] = useState<Autopilot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<AutopilotKind | null>(null);
  useEffect(() => { void api.autopilot?.().then((r) => (r.ok ? setAuto(r.data) : setError(r.error))); }, [api]);
  if (!api.autopilot) return null;
  const flip = async (kind: AutopilotKind) => {
    if (!auto) return;
    setBusy(kind); setError(null);
    const r = await api.autopilotSet!(kind, !auto[kind]);
    setBusy(null);
    if (r.ok) setAuto(r.data); else setError(r.error);
  };
  return (
    <section className="studio-card stack-8">
      <span className="title">Autopilot</span>
      <span className="subtext">
        The weekly drafts go live on their own, and stories run one after another in your Stories order. Pause any of them
        to approve it yourself first.
      </span>
      {error && <span className="meta error-text">{error}</span>}
      {auto && (Object.keys(AUTOPILOT_LABEL) as AutopilotKind[]).map((k) => (
        <div key={k} className="row" style={{ justifyContent: "space-between", gap: 12 }}>
          <span style={{ minWidth: 0 }}>
            <span className="body-strong" style={{ display: "block" }}>{AUTOPILOT_LABEL[k].title}</span>
            <span className="meta">{auto[k] ? AUTOPILOT_LABEL[k].on : AUTOPILOT_LABEL[k].off}</span>
          </span>
          <Toggle on={auto[k]} disabled={busy !== null} onChange={() => void flip(k)} label={`${AUTOPILOT_LABEL[k].title} autopilot`} />
        </div>
      ))}
    </section>
  );
}
