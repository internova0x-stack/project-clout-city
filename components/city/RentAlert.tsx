"use client";

import type { RentAlert } from "@/lib/cityState";
import { CloseIcon } from "../icons";

// The rent alarm on the home screen (owner, Oct 22): late bills or rent coming with too little in the bank. Two ways
// out, right there: a gig, or the bill itself. Dismissing hides it until the alarm changes (another bill, a new day).
export function RentAlertCard({ alert, onGigs, onBills, onDismiss }: { alert: RentAlert; onGigs: () => void; onBills: () => void; onDismiss: () => void }) {
  return (
    <div className={`story-prompt rent-alert ${alert.level}`} role="alert">
      <div className="rent-alert-main">
        <span className="title" style={{ display: "block" }}>{alert.title}</span>
        <span className="meta" style={{ display: "block" }}>{alert.line}</span>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          {!alert.canPay && <button className="btn btn-taxi btn-sm" onClick={onGigs}>💼 Find a gig</button>}
          {alert.level !== "short" && <button className={`btn btn-sm ${alert.canPay ? "btn-taxi" : "btn-secondary"}`} onClick={onBills}>🧾 Bills</button>}
        </div>
      </div>
      <button className="story-prompt-close" onClick={onDismiss} aria-label="Dismiss"><CloseIcon size={14} /></button>
    </div>
  );
}
