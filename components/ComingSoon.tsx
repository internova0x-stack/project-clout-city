"use client";

import { Sheet } from "./Sheet";

// Witty "Coming soon" cards for everything v0.1 doesn't build yet
// (Milestones rule 1). Copy never implies the feature exists today.

export type ComingSoonKey =
  | "tasks" | "daily" | "events" | "places" | "bills" | "look"
  | "phone" | "shop" | "clout" | "networth" | "bank" | "sound" | "stats" | "place";

const COPY: Record<ComingSoonKey, { emoji: string; title: string; body: string }> = {
  tasks: { emoji: "📋", title: "Tasks & Goals", body: "Your to-do list is being written by an unpaid intern. It'll land when the city opens." },
  daily: { emoji: "✅", title: "Daily Tasks", body: "Five things to do every day, for cash. Not yet, though. Enjoy the last free day of your life." },
  events: { emoji: "🍾", title: "Events", body: "The guest list is still being argued over. Parties open when the city does." },
  places: { emoji: "🏙️", title: "Places", body: "The bouncers are still learning your name. Places open soon." },
  bills: { emoji: "🧾", title: "Bills", body: "No rent due. Savor this. It is the only time in New York history." },
  look: { emoji: "🪞", title: "Your Look", body: "Your wardrobe is in transit. Very fashionably late." },
  phone: { emoji: "📱", title: "Phone", body: "No signal yet. The gossip, the news and the group chat arrive soon." },
  shop: { emoji: "🛍️", title: "Shop", body: "The racks are empty and the price tags are being inflated. Opening soon." },
  clout: { emoji: "🔥", title: "Clout", body: "Clout is how much strangers care that you exist. Scoring starts when the city opens." },
  networth: { emoji: "💎", title: "Net worth", body: "Everything you own that you can casually mention. Right now that's an outfit." },
  bank: { emoji: "💵", title: "Bank balance", body: "Your account is open. It's just very, very quiet. Cash arrives when the city opens." },
  sound: { emoji: "🎧", title: "Music", body: "The DJ is still soundchecking. Background music is coming soon." },
  stats: { emoji: "⚡", title: "Energy, Mood & Confidence", body: "Your vibes are being calibrated. Stats switch on when the city opens." },
  place: { emoji: "📍", title: "Coming soon", body: "This spot opens its doors soon. Until then, admire it from the sidewalk like everyone else." },
};

export function ComingSoon({
  which,
  title,
  onClose,
}: {
  which: ComingSoonKey | null;
  title?: string;
  onClose: () => void;
}) {
  const copy = which ? COPY[which] : null;
  return (
    <Sheet open={!!copy} onClose={onClose} label={title ?? copy?.title ?? "Coming soon"}>
      {copy && (
        <div className="stack-16" style={{ paddingTop: 8 }}>
          <div
            aria-hidden="true"
            style={{ width: 56, height: 56, borderRadius: 14, background: "#fff", boxShadow: "var(--elev-1)", display: "grid", placeItems: "center", fontSize: 28 }}
          >
            {copy.emoji}
          </div>
          <div className="stack-4">
            <div className="row" style={{ gap: 10 }}>
              <h2 className="display-lg" style={{ margin: 0 }}>{title ?? copy.title}</h2>
            </div>
            <span className="tag tag-event" style={{ marginTop: 8 }}>Coming soon</span>
          </div>
          <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>{copy.body}</p>
          <button className="btn btn-taxi" onClick={onClose}>Got it</button>
        </div>
      )}
    </Sheet>
  );
}
