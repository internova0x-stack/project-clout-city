"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { LOLA_PORTRAIT } from "@/lib/cast";
import { sfx } from "@/lib/sfx";
import { guardTaps } from "@/lib/tapGuard";
import { tierOf, type Crown } from "@/lib/schoolRace";
import type { SchoolRival } from "@/lib/schoolApi";

// Meet the rival (the Homecoming race, docs/SCHOOL-RACE.md): the first time an enrolled student without a race walks onto
// the Quad, the reigning royal makes an entrance. The takeover card (Celebrate.tsx's cel-card): the rival's portrait, their
// line, the two student IDs (you, a nobody; them, the crown) and Lola. Once per device (GameShell); "Run against" opens
// Crown HQ's Declare screen.

export function MeetRival({ open, rival, crown, me, onRun, onLater }: {
  open: boolean;
  rival: SchoolRival | null;
  crown: Crown;
  me: ReactNode;
  onRun: () => void;
  onLater: () => void;
}) {
  const done = useRef(false);
  useEffect(() => { if (open) { done.current = false; sfx.fanfare("stamp"); } }, [open]);
  if (!open || !rival) return null;
  const her = crown === "queen";
  const name = rival.name.split(" ")[0];
  const once = (fn: () => void) => () => { if (done.current) return; done.current = true; guardTaps(); fn(); };
  return (
    <div className="modal-wrap cel-wrap" role="dialog" aria-modal="true" aria-label={`Homecoming: ${rival.name}`}>
      <div className="cel-veil" onClick={once(onLater)} />
      <div className="modal-card cel-card">
        <div className="cel-art people">
          <span className="cel-rays" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="cel-medal crown-medal"><img src={`/cast/${rival.portrait}.webp`} alt={rival.name} /></span>
        </div>
        <div className="cel-body">
          <span className="tag tag-event cel-rise" style={{ animationDelay: ".56s" }}>Homecoming</span>
          <span className="display-lg cel-rise" style={{ animationDelay: ".65s" }}>{rival.name}</span>
          <p className="cel-line cel-rise" style={{ animationDelay: ".74s" }}>“{rival.entrance}”</p>
          <div className="crown-ids cel-rise" style={{ animationDelay: ".9s" }}>
            <span className="crown-id you"><span className="crown-face">{me}</span><span className="title">You</span><span className="meta">{tierOf(0, crown)}</span></span>
            <span className="crown-id">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="crown-face" src={`/cast/${rival.portrait}.webp`} alt="" />
              <span className="title">{name}</span><span className="meta">{tierOf(100, crown)}</span>
            </span>
          </div>
          <span className="cel-lola cel-rise" style={{ animationDelay: "1.1s" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOLA_PORTRAIT} alt="Lola Lowdown" width={36} height={36} />
            <span>Three years running. Nobody&apos;s ever made {her ? "her" : "him"} sweat.</span>
          </span>
          <span className="cel-acts cel-rise" style={{ animationDelay: "1.3s" }}>
            <button className="btn btn-secondary" onClick={once(onLater)}>Not now</button>
            <button className="btn btn-taxi" onClick={once(onRun)}>Run against {her ? "her" : "him"}</button>
          </span>
        </div>
      </div>
    </div>
  );
}
