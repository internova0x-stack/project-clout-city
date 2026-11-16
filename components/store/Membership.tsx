"use client";

// Membership & purchases (owner, Oct 18): opened from Phone → Settings and from your profile. Shows the VIP
// plan as Stripe has it, chat forever, and every real-money purchase; "Manage billing" opens Stripe's billing
// portal (switch monthly/yearly, update the card, cancel at the end of the paid period, receipts).

import { useEffect, useState } from "react";
import { Sheet } from "../Sheet";
import { VIP_PERKS } from "@/lib/meet";
import { formatPrice } from "@/lib/store";
import { membershipDate, vipLine, type MembershipApi, type MembershipState } from "@/lib/membership";
import { PASS_EMOJI, tierFor, type PassState } from "@/lib/seasonPass";

/**
 * The Clout Pass on the membership card (owner, Nov 16): included for a VIP, owned, or on sale, and a way to it.
 * Absent outside a season or before migration 0156.
 */
function PassRow({ pass, onOpen }: { pass: { state: PassState; price: string | null; onOpen: () => void }; onOpen?: () => void }) {
  const s = pass.state;
  if (s.phase !== "on" && s.phase !== "claim") return null;
  const t = tierFor(s.xp, s.season);
  const line = s.vip ? `${s.season.name} · included with your VIP`
    : s.paid ? `${s.season.name} · yours for the season`
    : `${s.season.name} · level ${t.tier}, paid row${pass.price ? ` ${pass.price}` : " on sale"}`;
  return (
    <button className="member-pass" onClick={onOpen ?? pass.onOpen}>
      <span aria-hidden="true" className="member-emoji">{PASS_EMOJI}</span>
      <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <span className="title member-name">Clout Pass</span>
        <span className="meta" style={{ display: "block" }}>{line}</span>
      </span>
      <span className={`tag ${s.vip || s.paid ? "tag-positive" : "tag-gold"}`}>{s.vip ? "Included" : s.paid ? "Owned" : "Get it"}</span>
    </button>
  );
}

export function MembershipSheet({ open, onClose, api, onGetVip, onToast, pass }: {
  /** The Clout Pass row (migration 0156): this season's state, the pass's price and a way to Tasks → Pass. */
  pass?: { state: PassState; price: string | null; onOpen: () => void } | null;
  open: boolean;
  onClose: () => void;
  api: MembershipApi;
  /** Opens the VIP offer. */
  onGetVip: () => void;
  onToast?: (t: string) => void;
}) {
  const [state, setState] = useState<MembershipState | null>(null);
  const [busy, setBusy] = useState(false);
  // Owner, Nov 16: a billing page that can't open says why inside the card, not in a toast over the top of the screen.
  const [portalErr, setPortalErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let stop = false;
    void api.state().then((r) => { if (!stop) r.ok ? setState(r.data) : onToast?.(r.error); });
    return () => { stop = true; };
  }, [open, api, onToast]);
  const manage = async () => {
    setBusy(true);
    setPortalErr(null);
    const r = await api.portal();
    if (r.ok) window.location.href = r.data.url;
    else { setBusy(false); setPortalErr(r.error); }
  };
  const vip = state?.vip;
  return (
    <Sheet open={open} onClose={onClose} label="Membership and purchases" tall>
      <div className="stack-16">
        <div>
          <h2 className="display-md" style={{ margin: 0 }}>Membership &amp; purchases</h2>
          <p className="meta" style={{ margin: "4px 0 0" }}>Real money only. Your C$ lives in the Bank app.</p>
        </div>
        {!state ? <p className="meta">Checking with the bank…</p> : (<>
          {vip ? (
            <div className={`member-card${vip.status === "past_due" ? " warn" : ""}`}>
              <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                <span className="tag tag-gold">👑 VIP {vip.plan}</span>
                {vip.status === "cancelling" && <span className="tag member-muted-tag">Not renewing</span>}
                {vip.status === "past_due" && <span className="tag member-warn-tag">Payment failed</span>}
              </div>
              <p className="title" style={{ margin: "10px 0 2px" }}>{vipLine(vip, formatPrice(vip.priceCents, vip.currency))}</p>
              <p className="meta" style={{ margin: 0 }}>
                {vip.status === "cancelling"
                  ? "Unlimited chat and side stories stay on until then. Changed your mind? Turn renewal back on."
                  : vip.status === "past_due"
                    ? "Update your card and VIP carries on. Stripe tries again for a few days before it ends."
                    : vip.plan === "monthly" ? "Switch to yearly and save, or cancel anytime: VIP runs to the end of what you paid for." : "Cancel anytime: VIP runs to the end of the year you paid for."}
              </p>
              <ul className="member-perks">
                {VIP_PERKS.map((p) => <li key={p.text}><span aria-hidden="true">{p.emoji}</span> {p.text}</li>)}
              </ul>
              {pass && <PassRow pass={pass} />}
              <button className="btn btn-secondary" style={{ width: "100%" }} disabled={busy} onClick={() => void manage()}>
                {busy ? "Opening Stripe…" : vip.status === "cancelling" ? "Turn renewal back on" : vip.status === "past_due" ? "Update card" : "Manage billing"}
              </button>
              {portalErr ? (
                <p className="member-err" role="alert">{portalErr}</p>
              ) : (
                <p className="meta" style={{ margin: "8px 0 0", textAlign: "center" }}>Switch plan, change card, cancel or get receipts, on Stripe.</p>
              )}
            </div>
          ) : (
            <div className="member-card free">
              <span className="tag tag-gold">👑 VIP</span>
              <p className="title" style={{ margin: "10px 0 2px" }}>{state.chatForever ? "You have chat forever" : "You're not a VIP. Yet."}</p>
              <p className="meta" style={{ margin: 0 }}>
                {state.chatForever ? "VIP adds every side story and the badge. Your chat stays unlimited either way." : "The velvet rope is right there, and it takes cards."}
              </p>
              <ul className="member-perks">
                {VIP_PERKS.map((p) => <li key={p.text}><span aria-hidden="true">{p.emoji}</span> {p.text}</li>)}
              </ul>
              {pass && <PassRow pass={pass} />}
              <button className="btn btn-taxi" style={{ width: "100%" }} onClick={onGetVip}>See VIP plans</button>
            </div>
          )}
          {state.chatForever && (
            <div className="list-row static">
              <span aria-hidden="true" style={{ fontSize: 20 }}>✨</span>
              <span style={{ flex: 1 }}>
                <span className="title" style={{ display: "block" }}>Chat forever</span>
                <span className="meta">Unlimited chat for good · no renewals</span>
              </span>
            </div>
          )}
          <div className="stack-8">
            <p className="overline" style={{ margin: 0 }}>Purchases</p>
            {state.purchases.length ? (
              <div className="member-list">
                {state.purchases.map((p) => (
                  <div key={p.id} className="member-row">
                    <span aria-hidden="true" className="member-emoji">{p.emoji}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="title member-name">{p.name}</span>
                      <span className="meta">{membershipDate(p.at)}{p.status === "refunded" && " · Refunded"}</span>
                    </span>
                    <span className={`member-price${p.status === "refunded" ? " refunded" : ""}`}>{formatPrice(p.amountCents, p.currency)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="meta" style={{ margin: 0 }}>Nothing yet. Your wallet sends its regards.</p>
            )}
            {state.canManage && !vip && (
              <button className="chip" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={() => void manage()}>{busy ? "Opening Stripe…" : "Receipts and card on Stripe"}</button>
            )}
            {portalErr && !vip && <p className="member-err" role="alert">{portalErr}</p>}
          </div>
          <div className="stack-4">
            <p className="overline" style={{ margin: 0 }}>Help</p>
            <p className="meta" style={{ margin: 0 }}>
              Payments go through Stripe; we never see your card. A charge looks wrong? Our contact address is in
              the <a href="/terms" target="_blank" rel="noreferrer">Terms</a>. Also: <a href="/privacy" target="_blank" rel="noreferrer">Privacy</a>.
            </p>
          </div>
        </>)}
      </div>
    </Sheet>
  );
}

/** Settings' top row and the profile's VIP line: who you are to the bank, and the way in. */
export function MembershipRow({ vip, onOpen }: { vip: "vip" | "forever" | null; onOpen: () => void }) {
  return (
    <button className="list-row member-entry" onClick={onOpen}>
      <span aria-hidden="true" style={{ fontSize: 20 }}>{vip === "vip" ? "👑" : vip === "forever" ? "✨" : "💳"}</span>
      <span style={{ flex: 1, textAlign: "left" }}>
        <span className="title" style={{ display: "block" }}>Membership &amp; purchases</span>
        <span className="meta">{vip === "vip" ? "VIP · manage your plan" : vip === "forever" ? "Chat forever · purchases" : "Go VIP · your purchases"}</span>
      </span>
      <span aria-hidden="true" className="meta">›</span>
    </button>
  );
}

/** The profile's line under your name: the VIP badge, or a way to become one. */
export function ProfileVip({ vip, until, onOpen }: { vip: boolean; until?: string | null; onOpen: () => void }) {
  return vip ? (
    <button className="profile-vip on" onClick={onOpen}>👑 VIP{until ? ` · until ${membershipDate(until)}` : ""}<span aria-hidden="true">›</span></button>
  ) : (
    <button className="profile-vip" onClick={onOpen}>👑 Go VIP<span aria-hidden="true">›</span></button>
  );
}
