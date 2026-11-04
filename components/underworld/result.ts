// A job for Pablo as a results screen (components/ResultCard.tsx; owner, Nov 4). BackRoomSheet shows one after each of
// today's jobs, from the screen before and after it (the server's view never carries odds or traces, and neither does
// this). The inline receipt in the back room stays.
//   paid (a clean win or one that left a trace: the trace stays hidden)  a win card: the cut, Street Rep toward the next tier
//   fizzled                                                              a near miss: no money, no fine, Street Rep kept
//   crew took the fall                                                   a near miss: the crew member covered you, Heat
//   busted                                                               a lose card: CAUGHT, the fine, Heat against 80
// The bar is Street Rep on a good night (what the job builds: bigger jobs) and Heat on a bad one (what the bust built:
// how close Pablo is to turning you away). Getting caught never costs home, career or crew, so those are the pills.

import { UNDERWORLD, type Landed, type OfferView, type UnderworldScreen, type UnderworldView } from "../../lib/underworld.ts";
import type { UnderworldHire } from "../../lib/marketplace.ts";
import type { Celebration } from "../Celebrate.tsx";
import type { ResultSpec } from "../ResultCard.tsx";

const TAG = "Pablo's job";

/** The receipt in one short line: the money and Whitlock & Hale's tail come off (the card shows them), then whole
 *  sentences up to about 120 characters. */
export function shortLine(text: string): string {
  const bare = text.replace(/\s*\+?C\$[\d,]+( for the boss)?\./g, "").replace(/\s*It cost you [^.]*\./, "").replace(/\s*Whitlock & Hale got it knocked down\./, "").trim();
  const parts = bare.match(/[^.!?]+[.!?]+["”]?|[^.!?]+$/g) ?? [bare];
  let out = "";
  for (const p of parts) {
    const next = `${out}${out ? " " : ""}${p.trim()}`;
    if (out && next.length > 120) break;
    out = next;
  }
  return out;
}

function repMeter(v: UnderworldView): ResultSpec["meter"] {
  if (!v.next) return { label: `${v.tier.emoji} Street Rep`, have: v.rep, need: UNDERWORLD.rep.max, max: UNDERWORLD.rep.max, say: `${v.tier.name}. Everybody on 30th Avenue knows.` };
  return { label: `${v.tier.emoji} Street Rep`, have: v.rep, need: v.next.at, max: v.next.at,
    say: `${v.next.at - v.rep} more to ${v.next.name}: bigger jobs, bigger money.` };
}

function heatMeter(v: UnderworldView): ResultSpec["meter"] {
  const refuse = UNDERWORLD.heat.refuse;
  return { label: "🚨 Heat", have: v.heat, need: refuse, max: UNDERWORLD.heat.max,
    say: v.heat >= refuse ? "Pablo won't work with you until you cool off. A quiet day cools you twice as fast." : `${refuse - v.heat} from Pablo saying no. A quiet day cools you twice as fast.` };
}

export function jobResult(offer: OfferView | undefined, before: UnderworldView, r: UnderworldScreen, onBench?: () => void): Celebration | null {
  if (!r.outcome || !r.receipt) return null;
  const after = r.view;
  const emoji = offer?.emoji ?? "🧳";
  const story = shortLine(r.receipt) || undefined;
  const dRep = after.rep - before.rep;
  const crewNow = offer?.crew ? after.crew.find((m) => m.name === offer.crew?.name) : undefined;
  const crewThen = crewNow ? before.crew.find((m) => m.id === crewNow.id) : undefined;
  const dLoyal = crewNow && crewThen ? crewNow.loyalty - crewThen.loyalty : 0;
  const crewPill = crewNow ? [dLoyal > 0 ? `${crewNow.emoji} ${crewNow.name} +${dLoyal} loyalty` : `${crewNow.emoji} ${crewNow.name} on your side`] : [];
  const cash = r.cash ?? 0;
  // The job's own title is its setup paragraph, too long for a card: the outcome is the title.
  const base = { rung: 3 as const, emoji, tag: TAG };

  if (r.outcome === "win" || r.outcome === "trace") {
    const tierUp = after.tier.name !== before.tier.name;
    return { ...base, title: tierUp ? `You're a ${after.tier.name} now` : "Job done", cta: "Back to Pablo", twist: "register",
      result: { tone: "win", amount: Math.max(0, cash), unit: "your cut", story,
        stamp: tierUp ? { text: after.tier.name.toUpperCase(), tone: "good" } : undefined,
        meter: repMeter(after),
        keep: [...(dRep > 0 ? [`+${dRep} Street Rep`] : []), ...crewPill, `${after.tier.emoji} ${after.tier.name}`] } };
  }

  if (r.outcome === "fizzle") {
    return { ...base, emoji: "🤷", title: "It didn't come off", cta: "Back to Pablo",
      result: { tone: "warn", story, meter: repMeter(after),
        keep: ["No fine", `${after.tier.emoji} ${after.tier.name}`, ...(crewPill.length ? crewPill : ["Your cash"])] } };
  }

  // Busted. A loyal crew member may have taken the fall: no fine, no holding.
  const coveredBy = after.crew.find((m) => !m.covers && before.crew.find((b) => b.id === m.id)?.covers);
  const held = r.held ?? 0;
  if (coveredBy && cash === 0 && held === 0) {
    return { ...base, emoji: "🫡", title: `${coveredBy.name} took the fall`, cta: "Back to Pablo",
      result: { tone: "warn", stamp: { text: "COVERED", tone: "good" }, amount: 0, unit: "fine", story, meter: heatMeter(after),
        keep: ["No fine", "No holding", `${coveredBy.emoji} ${coveredBy.name}`] } };
  }
  const fine = Math.max(0, -cash);
  return { ...base, emoji: "🚓", title: held ? `${held} hour${held > 1 ? "s" : ""} at the 114½` : "Busted",
    cta: held ? "Go to the bench" : "Lay low", onCta: held ? onBench : undefined,
    result: { tone: "lose", stamp: { text: "CAUGHT", tone: "bad" }, ...(fine ? { amount: fine, unit: "fine" } : {}), story,
      meter: heatMeter(after), keep: ["Your home", "Your job", "Your crew"] } };
}

// ---- Pablo's extras (owner, Nov 4) -------------------------------------------------------------------------------------
//   the Thursday table (always pays)    a win card like a paid job: the take, Street Rep toward the next tier
//   a runner's job, you ran it          a banner with your cut (a fizzle or a bust is the job's own card: you wore it)
//   a runner's job, your runner ran it  a banner with Pablo's take (or that it didn't come off)
//   an old job that came back           a near miss: the fine (or the crew covering), Heat against 80, home, job and crew kept

/** Pablo's Thursday table: Hustlers only, once a week, always pays. */
export function tableResult(before: UnderworldView, r: UnderworldScreen): Celebration | null {
  if (!r.receipt) return null;
  const after = r.view;
  const dRep = after.rep - before.rep;
  const tierUp = after.tier.name !== before.tier.name;
  return { rung: 3, emoji: "🃏", tag: "Pablo's table", title: tierUp ? `You're a ${after.tier.name} now` : "The table paid", cta: "Back to Pablo", twist: "register",
    result: { tone: "win", amount: Math.max(0, r.cash ?? 0), unit: "from the table", story: shortLine(r.receipt) || undefined,
      stamp: tierUp ? { text: after.tier.name.toUpperCase(), tone: "good" } : undefined,
      meter: repMeter(after),
      keep: [...(dRep > 0 ? [`+${dRep} Street Rep`] : []), "A chair next Thursday", `${after.tier.emoji} ${after.tier.name}`] } };
}

const at = (name: string | null | undefined) => (name ? `@${name}` : "your friend");
const cs = (n: number) => `C$${Math.round(n).toLocaleString("en-US")}`;

/** You ran a friend's job. A clean one is a banner with the cut; anything else is the job's own card. */
export function runnerResult(hire: Pick<UnderworldHire, "emoji" | "title" | "withName">, before: UnderworldView, r: UnderworldScreen, onBench?: () => void): Celebration | null {
  if (!r.outcome) return null;
  if (r.outcome === "win" || r.outcome === "trace") {
    const cut = r.cut ?? 0;
    return { rung: 2, emoji: hire.emoji ?? "🏃", tag: "Runner job", title: `Done for ${at(hire.withName)}`,
      rewards: cut > 0 ? [{ tone: "cash", text: `+${cs(cut)} cut` }] : undefined };
  }
  const offer: OfferView = { id: "hire", emoji: hire.emoji ?? "🏃", title: hire.title, done: true, options: [] };
  return jobResult(offer, before, r, onBench);
}

/** Your runner ran your job: Pablo's take, or that it didn't come off. Null while it's still waiting. */
export function hireBanner(h: UnderworldHire): Celebration | null {
  if (h.status !== "done" || !h.outcome) return null;
  const emoji = h.emoji ?? "🧳";
  if (h.outcome === "win" || h.outcome === "trace") {
    return { rung: 2, emoji, tag: "Your runner", title: `${at(h.withName)} ran it`, rewards: h.pay > 0 ? [{ tone: "cash", text: `+${cs(h.pay)} Pablo's take` }] : undefined };
  }
  return { rung: 2, emoji: h.outcome === "bust" ? "🚓" : "🤷", tag: "Your runner",
    title: h.outcome === "bust" ? `${at(h.withName)} got caught. Not on you.` : `${at(h.withName)} came back empty` };
}

/** An old job that came back (a trace the 114½ found): a near miss, never grey. */
export function landedResult(l: Landed, v: UnderworldView, onBench?: () => void): Celebration {
  const covered = l.fine === 0 && l.holding === 0;
  const held = l.holding;
  return { rung: 3, emoji: l.emoji || "🚨", tag: "It came back",
    title: covered ? "Somebody covered for you" : held ? `${held} hour${held > 1 ? "s" : ""} at the 114½` : "An old job caught up",
    cta: held ? "Go to the bench" : "Got it", onCta: held ? onBench : undefined,
    result: { tone: "warn", stamp: covered ? { text: "COVERED", tone: "good" } : { text: "TRACED", tone: "bad" },
      ...(l.fine > 0 ? { amount: l.fine, unit: "fine" } : {}), story: shortLine(l.text) || undefined, meter: heatMeter(v),
      keep: ["Your home", "Your job", "Your crew"] } };
}
