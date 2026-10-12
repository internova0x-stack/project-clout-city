"use client";

import { useEffect, useState } from "react";
import { GAME_CONFIG } from "@/lib/config";
import { CRUSH_INVITE_TEXT } from "@/lib/dating";
import { cliqueProgress, inviteUrl } from "@/lib/invite";
import type { CliqueMember } from "@/lib/player";
import { getStyle } from "@/lib/styles";
import { CopyIcon, ShareIcon } from "./icons";
import { Sheet } from "./Sheet";

// The invite screen (Clarifications section 7; Milestones v0.1): a personal
// link, a share button and the clique count. Rewards switch on in v0.2.
export function InviteSheet({
  open,
  onClose,
  inviteCode,
  clique,
  crush = false,
  onShared,
}: {
  open: boolean;
  onClose: () => void;
  inviteCode: string;
  clique: CliqueMember[];
  /** The crush invite (Clarifications 14.2): the same link and rewards, with a playful, open message. */
  crush?: boolean;
  /** Analytics: the link was shared or copied. */
  onShared?: () => void;
}) {
  const [origin, setOrigin] = useState(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SITE_URL) setOrigin(window.location.origin);
  }, []);

  const link = origin ? inviteUrl(origin, inviteCode) : `/i/${inviteCode}`;
  const size = GAME_CONFIG.clique.bonusSize;
  const progress = cliqueProgress(clique.length, size);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      onShared?.();
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function share() {
    const text = crush ? CRUSH_INVITE_TEXT : "I'm on Clout City: New York's only ranking that counts. Claim your name before the city opens.";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Clout City NYC", text, url: link });
        onShared?.();
        return;
      } catch {
        // Cancelled share sheets are fine; fall through to nothing.
        return;
      }
    }
    await copy();
  }

  return (
    <Sheet open={open} onClose={onClose} label={crush ? "Crush invite" : "Invite your Clique"} tall>
      <div className="stack-24">
        <div className="stack-4" style={{ paddingRight: 44 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 className="display-lg" style={{ margin: 0 }}>{crush ? "Crush invite 💌" : "Invite your Clique"}</h2>
            <span className="body-strong" style={{ whiteSpace: "nowrap" }}>{progress.shown} of {size}</span>
          </div>
          <p className="subtext" style={{ margin: "4px 0 0" }}>
            {crush
              ? "Your crush isn't in the city yet? Send them this. It comes from you, by name, and pays the same as any invite."
              : "Main characters need a supporting cast. Send your link; everyone who signs up through it joins your clique."}
          </p>
          {crush && <p className="crush-invite-quote">&ldquo;{CRUSH_INVITE_TEXT}&rdquo;</p>}
        </div>

        <div className="card stack-12">
          <p className="overline" style={{ margin: 0 }}>Your link</p>
          <div className="row" style={{ background: "#fff", borderRadius: 12, padding: "10px 12px", boxShadow: "var(--elev-1)" }}>
            <span className="body-strong" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {link.replace(/^https?:\/\//, "")}
            </span>
            <button className="icon-round" onClick={copy} aria-label="Copy invite link">
              <CopyIcon size={16} />
            </button>
          </div>
          {copied && <p className="meta" style={{ margin: 0, color: "var(--green-text)" }} role="status">Copied. Go spread the word.</p>}
          <button className="btn btn-taxi" onClick={share}>
            <ShareIcon size={18} /> Share my link
          </button>
        </div>

        <div className="stack-8">
          <span className="title">Your clique</span>
          <div style={{ height: 8, borderRadius: 999, background: "var(--chip-off)", overflow: "hidden" }} role="progressbar" aria-valuemin={0} aria-valuemax={size} aria-valuenow={progress.shown}>
            <div style={{ width: `${progress.ratio * 100}%`, height: "100%", background: "var(--taxi-400)", borderRadius: 999, transition: "width .4s ease-out" }} />
          </div>
          <p className="meta" style={{ margin: "4px 0 0" }}>Rewards unlock when the city opens.</p>
        </div>

        <div className="stack-8">
          {clique.length === 0 ? (
            <div className="card center">
              <p className="title" style={{ margin: 0 }}>Nobody yet</p>
              <p className="subtext" style={{ margin: "4px 0 0" }}>A clique of one is just a mood. Send that link.</p>
            </div>
          ) : (
            clique.map((m) => {
              const s = getStyle(m.starting_style);
              return (
                <div key={`${m.display_name}-${m.joined_at}`} className="card row" style={{ gap: 12 }}>
                  <span style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--night-900)", border: "2px solid var(--taxi-400)", display: "grid", placeItems: "center", fontSize: 18 }} aria-hidden="true">
                    {s.emoji}
                  </span>
                  <span className="stack-4" style={{ flex: 1, minWidth: 0 }}>
                    <span className="title" style={{ display: "block" }}>{m.display_name}</span>
                    <span className="subtext" style={{ display: "block" }}>{s.label}</span>
                  </span>
                  <span className="tag tag-positive">Joined</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Sheet>
  );
}
