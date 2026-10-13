"use client";

import { useEffect, useState } from "react";
import { placeById } from "@/lib/city";
import type { CrewApi, CrewPerson } from "@/lib/crew";
import { eventTimeLine } from "@/lib/localTime";
import { mentionLine, type PartyMention, type PlusOne } from "@/lib/party";
import type { ExclusiveEvent } from "@/lib/store";
import { handle } from "@/lib/validation";
import { Avatar } from "../crew/Crew";
import { ChevronRightIcon, CloseIcon } from "../icons";
import { Sheet } from "../Sheet";
import { PlaceArt } from "./PlaceArt";

/**
 * v0.9 (#19): pick a plus-one from your crew. One per ticket; they don't pay and get no ticket
 * clout, but go on the list with their own event card and badge.
 */
export function PlusOneSheet({ event, crew, taken, busy, onClose, onSend, onInviteFriends }: {
  event: ExclusiveEvent | null;
  crew?: CrewApi;
  /** People who can't be asked again for this party (already declined). */
  taken: string[];
  busy: boolean;
  onClose: () => void;
  onSend: (guest: CrewPerson) => void;
  onInviteFriends: () => void;
}) {
  const [people, setPeople] = useState<CrewPerson[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    if (!event) return;
    setPeople(null);
    setPicked(null);
    if (!crew) return setPeople([]);
    void crew.members().then((r) => {
      const list = r.ok ? r.data.filter((p) => !taken.includes(p.id)) : [];
      setPeople(list);
      setPicked(list[0]?.id ?? null);
    });
  }, [event, crew, taken]);
  const guest = people?.find((p) => p.id === picked);
  return (
    <Sheet open={!!event} onClose={onClose} label="Bring a plus-one">
      {event && (
        <div className="stack-16">
          <div className="stack-4" style={{ paddingRight: 44 }}>
            <h2 className="display-md" style={{ margin: 0 }}>➕ Bring a plus-one</h2>
            <p className="subtext" style={{ margin: 0 }}>{event.name} · {eventTimeLine(event.startsAt)}</p>
          </div>
          {people === null && <p className="meta">Checking your crew…</p>}
          {people?.length === 0 && (
            <>
              <div className="card stack-8" style={{ textAlign: "center", padding: "22px 16px" }}>
                <span style={{ fontSize: 36 }} aria-hidden="true">🫥</span>
                <p className="title" style={{ margin: 0 }}>Nobody to bring yet</p>
                <p className="subtext" style={{ margin: 0 }}>Plus-ones come from your crew. Invite a friend; once they join, they can come along.</p>
              </div>
              <button className="btn btn-taxi" onClick={onInviteFriends}>Invite friends</button>
            </>
          )}
          {people && people.length > 0 && (
            <>
              <div className="stack-4" role="radiogroup" aria-label="Who">
                {people.map((p) => (
                  <button key={p.id} role="radio" aria-checked={picked === p.id} className="list-row crew-pick" aria-pressed={picked === p.id} onClick={() => setPicked(p.id)}>
                    <Avatar style={p.style} />
                    <span className="title" style={{ flex: 1, textAlign: "left" }}>{handle(p.name)}</span>
                    <span className={`crew-check${picked === p.id ? " on" : ""}`} aria-hidden="true">✓</span>
                  </button>
                ))}
              </div>
              <button className="btn btn-taxi" disabled={busy || !guest} onClick={() => guest && onSend(guest)}>
                {busy ? "Sending…" : guest ? `Invite ${handle(guest.name)}` : "Pick someone"}
              </button>
              <p className="meta" style={{ margin: 0, textAlign: "center" }}>
                They don&apos;t pay and don&apos;t get the ticket&apos;s clout. Same Mood and Confidence for going, their own event card and badge.
              </p>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** Home card: someone from your crew wants you as their plus-one. */
export function PartyPrompt({ invite, onOpen, onDismiss }: { invite: PlusOne; onOpen: () => void; onDismiss: () => void }) {
  return (
    <div className="story-prompt party-prompt" role="status">
      <button className="story-prompt-main" onClick={onOpen}>
        <span className="story-prompt-tile" aria-hidden="true">🎟️</span>
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <span className="overline" style={{ display: "block", color: "rgba(255,246,224,.75)" }}>You&apos;re a plus-one</span>
          <span className="title one-line" style={{ display: "block", color: "#fff" }}>{handle(invite.host.name)}: {invite.eventName}</span>
        </span>
        <ChevronRightIcon size={18} />
      </button>
      <button className="story-prompt-close" onClick={onDismiss} aria-label="Dismiss"><CloseIcon size={14} /></button>
    </div>
  );
}

/** After the party: what you keep. The event card, the badge and (unless you opted out) the News line. */
export function KeepsakeSheet({ event, plusOneOf, mention, optedOut, onClose, onOpenCollection }: {
  event: ExclusiveEvent | null;
  plusOneOf?: string | null;
  mention: PartyMention | null;
  optedOut: boolean;
  onClose: () => void;
  onOpenCollection?: () => void;
}) {
  const place = event ? placeById(event.placeId) : undefined;
  return (
    <Sheet open={!!event} onClose={onClose} label="You were there">
      {event && (
        <div className="stack-16">
          <div className="stack-4" style={{ textAlign: "center", padding: "0 36px" }}>
            <p className="overline" style={{ margin: 0 }}>You were there</p>
            <h2 className="display-md" style={{ margin: 0 }}>{event.name}</h2>
          </div>
          <div className="keepsakes">
            <button className="keepsake keepsake-card" onClick={onOpenCollection} disabled={!onOpenCollection}>
              <span className="keepsake-art">{place && <PlaceArt place={place} daytime={false} />}</span>
              <b>🎟️ Event card</b>
              <small>{plusOneOf ? `+1 with ${handle(plusOneOf)}` : "In your Collection"}</small>
            </button>
            <div className="keepsake">
              <span className="keepsake-emoji" aria-hidden="true">🎟️</span>
              <b>Profile badge</b>
              <small>Was at {event.name}</small>
            </div>
          </div>
          <div className="keepsake-news">
            <p className="overline" style={{ margin: "0 0 4px" }}>📰 The News · Lola Lowdown</p>
            {optedOut ? (
              <p className="body" style={{ margin: 0 }}>You asked to stay out of the gossip, so Lola kept your name out of it. Mysterious.</p>
            ) : (
              <p className="body" style={{ margin: 0 }}>{mention ? mentionLine(mention) : `Spotted at ${event.name}: you.`} The phones were in the velvet bag; the gossip was not.</p>
            )}
          </div>
          <button className="btn btn-taxi" onClick={onClose}>Nice</button>
        </div>
      )}
    </Sheet>
  );
}

/** In the News app: "Spotted at" lines from parties you went to. */
export function SpottedCard({ m }: { m: PartyMention }) {
  return (
    <div className="card stack-4 spotted-card">
      <span className="tag tag-event" style={{ alignSelf: "flex-start" }}>📸 Spotted · Lola Lowdown</span>
      <p className="body" style={{ margin: 0 }}>{mentionLine(m)}</p>
    </div>
  );
}
