"use client";

import { useState } from "react";
import { Sheet } from "./Sheet";

// Delete my account (owner, Oct 27; GDPR right to erasure). Settings' last row opens this; typing DELETE confirms.
// The server cancels any VIP plan, removes photos and the account, then the game goes to the welcome page.

export type DeleteAccountAction = (confirm: string) => Promise<{ ok: true } | { ok: false; error: string }>;

export function DeleteAccountSheet({ open, onClose, onDelete }: { open: boolean; onClose: () => void; onDelete: DeleteAccountAction }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = typed.trim().toUpperCase() === "DELETE";
  const go = async () => {
    setBusy(true);
    setError(null);
    const r = await onDelete(typed).catch(() => ({ ok: false as const, error: "Something went wrong. Nothing changed; try again." }));
    if (!r.ok) { setBusy(false); setError(r.error); return; }
    window.location.assign("/?bye=1&deleted=1");
  };
  return (
    <Sheet open={open} onClose={() => { if (!busy) { setTyped(""); setError(null); onClose(); } }} label="Delete your account">
      <div className="stack-16">
        <div className="stack-4" style={{ paddingRight: 44 }}>
          <h2 className="display-md" style={{ margin: 0 }}>Delete your account?</h2>
          <span className="meta">This can&apos;t be undone. It happens right away.</span>
        </div>
        <ul className="delete-list">
          <li>Your character, cash, clout, home, items, skills and progress are deleted.</li>
          <li>Your chats, crew links, dates and Clout TV photos are deleted.</li>
          <li>Any VIP plan is cancelled now and won&apos;t renew. Things bought with real money go with the account.</li>
          <li>Your email can sign up again later, as a brand-new player.</li>
        </ul>
        <p className="meta" style={{ margin: 0 }}>Just want a fresh start instead? Use <b>Start over</b> on the welcome screen: it keeps your account, name and purchases.</p>
        <label className="field">
          <span className="meta">Type DELETE to confirm</span>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-label="Type DELETE to confirm" />
        </label>
        {error && <p className="error-text" role="alert" style={{ margin: 0 }}>{error}</p>}
        <button className="btn btn-destructive" disabled={!ready || busy} onClick={() => void go()}>{busy ? "Deleting…" : "Delete my account forever"}</button>
      </div>
    </Sheet>
  );
}

/** Settings' last row. */
export function DeleteAccountRow({ onOpen }: { onOpen: () => void }) {
  return <button className="link-btn delete-row" onClick={onOpen}>Delete my account</button>;
}
