"use client";

import { useEffect, useState } from "react";
import { ECONOMY, formatCash } from "@/lib/economy";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Sheet } from "../Sheet";

/** Tasks/Goals (C9 Daily / Goals). In v0.2 the first task is the only task. */
export function TasksSheet({
  open, onClose, partyDone, onOpenParty, cliqueCount,
}: { open: boolean; onClose: () => void; partyDone: boolean; onOpenParty: () => void; cliqueCount: number }) {
  const [tab, setTab] = useState<"daily" | "goals">("daily");
  const { cliqueSize } = ECONOMY.invites;
  return (
    <Sheet open={open} onClose={onClose} label="Tasks and goals">
      <div className="stack-16">
        <h2 className="display-lg" style={{ margin: 0, paddingRight: 44 }}>Tasks</h2>
        <div className="segmented" role="group" aria-label="Tasks">
          <button aria-pressed={tab === "daily"} onClick={() => setTab("daily")}>Daily</button>
          <button aria-pressed={tab === "goals"} onClick={() => setTab("goals")}>Goals</button>
        </div>
        {tab === "daily" ? (
          <div className="stack-12">
            <div className={`select-card multi`} aria-pressed={partyDone} style={{ cursor: partyDone ? "default" : "pointer" }} onClick={partyDone ? undefined : onOpenParty} role="button" tabIndex={0}>
              <span className="select-emoji" aria-hidden="true">🍾</span>
              <span className="title" style={{ display: "block" }}>You&apos;ve been invited to a party</span>
              <span className="subtext" style={{ display: "block" }}>{partyDone ? "Done. You were seen." : "First task. Pull up to Velvet Static in Long Island City."}</span>
              {partyDone && <span className="select-check" aria-hidden="true">✓</span>}
            </div>
            <div className="card hazard-edge stack-4" style={{ paddingLeft: 22 }}>
              <p className="overline" style={{ margin: 0 }}>Coming soon</p>
              <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>Five daily tasks, paid in cash, reset at midnight New York time. The to-do list is still being argued over.</p>
            </div>
          </div>
        ) : (
          <div className="select-card multi" aria-pressed={cliqueCount >= cliqueSize}>
            <span className="select-emoji" aria-hidden="true">👯</span>
            <span className="title" style={{ display: "block" }}>Build a clique of {cliqueSize}</span>
            <span className="subtext" style={{ display: "block" }}>{Math.min(cliqueCount, cliqueSize)} of {cliqueSize} friends joined through your link.</span>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** Events: the first-task party until it's done; club events arrive with v0.3. */
export function EventsSheet({ open, onClose, partyDone, onOpenParty }: { open: boolean; onClose: () => void; partyDone: boolean; onOpenParty: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} label="Events">
      <div className="stack-16">
        <h2 className="display-lg" style={{ margin: 0, paddingRight: 44 }}>Events</h2>
        {partyDone ? (
          <div className="card hazard-edge stack-4" style={{ paddingLeft: 22 }}>
            <p className="overline" style={{ margin: 0 }}>Coming soon</p>
            <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>No more parties tonight. Even Queens needs a night off. Club events open soon.</p>
          </div>
        ) : (
          <button className="party-card" style={{ textAlign: "left", width: "100%" }} onClick={onOpenParty}>
            <span className="tag tag-event">🍸 Club event · Happening now</span>
            <span className="title" style={{ display: "block", marginTop: 8 }}>You&apos;ve been invited to a party</span>
            <span className="subtext" style={{ display: "block" }}>Velvet Static, Long Island City</span>
          </button>
        )}
      </div>
    </Sheet>
  );
}

interface LedgerRow { id: number; currency: "cash" | "clout"; amount: number; kind: string; created_at: string }

const LABELS: Record<string, string> = {
  birth_lottery: "🎲 Birth lottery",
  rent: "🏠 First month's rent",
  party_entry: "🍸 Party entry",
  party_reward: "🍾 Party: you were seen",
};

/** Bank balance → transaction history. */
export function BankSheet({ open, onClose, bank }: { open: boolean; onClose: () => void; bank: number }) {
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  useEffect(() => {
    if (!open) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return setRows([]);
    supabase
      .from("ledger")
      .select("id, currency, amount, kind, created_at")
      .eq("currency", "cash")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setRows((data as LedgerRow[]) ?? []));
  }, [open, bank]);
  return (
    <Sheet open={open} onClose={onClose} label="Bank">
      <div className="stack-16">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", paddingRight: 44 }}>
          <h2 className="display-lg" style={{ margin: 0 }}>Bank</h2>
          <span className="body-strong">{formatCash(bank)}</span>
        </div>
        <p className="subtext" style={{ margin: 0 }}>Virtual cash only. It can never be bought with real money.</p>
        <div>
          {rows === null && <p className="meta">Loading…</p>}
          {rows?.map((r) => (
            <div key={r.id} className="ledger-row">
              <span>
                <span className="title" style={{ display: "block", fontSize: 15 }}>{LABELS[r.kind] ?? r.kind}</span>
                <span className="meta">{new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              </span>
              <span className={`body-strong ${r.amount > 0 ? "money-pos" : "money-neg"}`}>
                {r.amount > 0 ? "+" : "−"}{formatCash(Math.abs(r.amount))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
