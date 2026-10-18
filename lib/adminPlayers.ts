// Studio Players (owner, Oct 15; migration 0055): what admin_players() and admin_player() return, and
// the words for each line of a player's activity. Safe to import anywhere.

import { CLUB_EVENTS, itemBySku, placeById } from "./city.ts";
import { ECONOMY } from "./economy.ts";

export type PlayerFilter = "all" | "new" | "active" | "paying" | "vip" | "banned" | "reported" | "no_home";
export type PlayerSort = "joined" | "seen" | "clout" | "worth" | "spend";

export const PLAYER_FILTERS: { id: PlayerFilter; label: string }[] = [
  { id: "all", label: "Everyone" }, { id: "new", label: "New this week" }, { id: "active", label: "Active today" },
  { id: "paying", label: "Paying" }, { id: "vip", label: "VIP" }, { id: "reported", label: "Reported" },
  { id: "banned", label: "Banned" }, { id: "no_home", label: "Never moved in" },
];
export const PLAYER_SORTS: { id: PlayerSort; label: string }[] = [
  { id: "joined", label: "Newest" }, { id: "seen", label: "Last seen" }, { id: "clout", label: "Clout" },
  { id: "worth", label: "Net worth" }, { id: "spend", label: "Spend" },
];

export interface PlayerRow {
  id: string; name: string; email: string | null; style: string; joinedAt: string; lastSeen: string | null;
  clout: number; cash: number; netWorth: number; rank: number; spendCents: number;
  vip: boolean; banned: boolean; openReports: number; movedIn: boolean;
}
export interface PlayerList { total: number; rows: PlayerRow[] }

export interface TimelineEntry {
  type: "ledger" | "purchase" | "renewal" | "joined" | "moved_in" | "reported" | "ban" | "unban";
  at: string;
  kind?: string;
  ref?: string | null;
  cash?: number;
  clout?: number;
  name?: string | null;
  status?: string;
  cents?: number | null;
}

export interface PlayerProfile {
  profile: {
    id: string; name: string; email: string | null; style: string; look: unknown; traits: string[] | null;
    homeId: string | null; houseSku: string | null; carSku: string | null; carMode: string | null; atPlace: string | null;
    birthCash: number | null; joinedAt: string; movedInAt: string | null; firstPartyAt: string | null; lastSeen: string | null;
    inviteCode: string; invitedBy: { id: string; name: string } | null; invitedCount: number; crewSize: number;
    rank: number; vip: boolean; vipSince: string | null; chatForever: boolean;
    banned: boolean; bannedAt: string | null; banReason: string | null; mutedUntil: string | null; warnedAt: string | null; admin: boolean;
  };
  numbers: {
    clout: number; cash: number; netWorth: number; energy: number; mood: number; confidence: number;
    spendCents: number; purchases: number; sessions: number; secondsPlayed: number; daysActive: number;
    messagesSent: number; businesses: number; placesVisited: number;
  };
  sessions: { startedAt: string; seconds: number }[];
  safety: {
    reportsAgainst: { id: number; reason: string; status: string; at: string; by: string | null }[];
    reportsMade: number; blocked: number; blockedBy: number;
    actions: { action: "ban" | "unban"; reason: string | null; at: string; by: string | null }[];
  };
  timeline: TimelineEntry[];
}

const place = (id: string | null | undefined) => (id ? placeById(id.split(":")[0]) : undefined);
const home = (id: string | null | undefined) => ECONOMY.homes.find((h) => h.id === id);

/** Words for the ledger's kinds; the place, item or event comes from the ref when there is one. */
const KIND: Record<string, [string, string]> = {
  birth_lottery: ["🎲", "Birth lottery"], visit: ["📍", "Visited"], daily_task: ["✅", "Daily task"], daily_bonus: ["🎯", "All 5 daily tasks"],
  shift: ["💼", "Worked a shift"], gig: ["🧾", "Gig paid"], event: ["🍸", "Club event"], event_entry: ["🎟️", "Club event entry"],
  party: ["🎉", "Party"], party_entry: ["🎟️", "Party ticket"], party_reward: ["🎉", "Party bonus"], purchase: ["🛍️", "Bought"],
  purchase_clout: ["🛍️", "Clout from a purchase"], refund_clout: ["↩️", "Clout taken back (refund)"], sale: ["💸", "Sold"],
  rent: ["🏠", "Rent"], bill_: ["🧾", "Bill"], car_rental: ["🚗", "Car rental"], broker_fee: ["🏠", "Broker fee"],
  travel: ["🚕", "Travel"], travel_skip: ["⏩", "Skipped the ride"], drink: ["🍹", "Drink at the bar"], groceries: ["🛒", "Groceries"],
  invite: ["💌", "Invite reward"], clique_bonus: ["👯", "Full crew bonus"], crew_friend: ["👯", "Crew outing"], crew_full: ["👯", "Whole crew came"],
  date_night: ["💘", "Date night"], prediction: ["🔮", "Story prediction"], story_task: ["📰", "Story task"], story_event: ["📰", "Story event"],
  hunt: ["🗺️", "Treasure hunt"], gossip: ["🍵", "Found gossip"], gossip_restroom: ["🍵", "Restroom gossip"],
  lotto_card: ["🎟️", "Lotto card"], lotto_prize: ["🍀", "Lotto prize"], lotto_pot: ["🍀", "Lotto pot"], lotto_jackpot: ["💰", "Lotto jackpot"],
  vip: ["👑", "VIP floor"], vip_cover: ["👑", "VIP cover"], business_buy: ["🏪", "Bought a business"], business_upgrade: ["🏪", "Upgraded a business"],
  business_till: ["🏪", "Collected the tills"], business_public: ["📈", "Took a business public"], together: ["👯", "Together bonus"],
  job_pay: ["🧰", "Job paid"], job_hold: ["🧰", "Job posted (pay held)"], job_refund: ["🧰", "Job pay returned"], job_cut: ["🧰", "Manager's cut"],
  goal: ["🎯", "Goal reached"], streak: ["🔥", "Streak reward"],
};

/** One line for the timeline: an emoji, what happened, and an optional detail. */
export function timelineLine(e: TimelineEntry): { emoji: string; text: string; detail?: string } {
  switch (e.type) {
    case "joined": return { emoji: "✨", text: "Made their character" };
    case "moved_in": return { emoji: "🔑", text: `Moved into ${home(e.ref)?.name ?? "a home"}` };
    case "purchase": return { emoji: "💳", text: `${e.status === "refunded" ? "Refunded" : "Paid"}: ${e.name ?? e.ref ?? "a product"}` };
    case "renewal": return { emoji: "👑", text: "VIP renewed" };
    case "reported": return { emoji: "🚩", text: `Reported for ${e.ref ?? "something"}`, detail: e.status };
    case "ban": return { emoji: "⛔", text: "Banned", detail: e.ref ?? undefined };
    case "unban": return { emoji: "🔓", text: "Unbanned", detail: e.ref ?? undefined };
    case "ledger": {
      const kind = e.kind ?? "";
      const [emoji, label] = KIND[kind] ?? KIND[kind.replace(/_.*/, "_")] ?? ["•", kind.replace(/_/g, " ")];
      const p = place(e.ref);
      const item = e.ref ? itemBySku(e.ref.split(":")[0]) : undefined;
      const ev = e.ref ? CLUB_EVENTS.find((x) => x.id === e.ref!.split(":")[0]) : undefined;
      const what = ev?.name ?? p?.name ?? item?.name;
      return { emoji, text: what ? `${label}: ${what}` : label };
    }
  }
}

/** "C$1,200 · +50 clout", for a ledger line's changes. */
export function changesLine(e: TimelineEntry): string {
  const parts: string[] = [];
  if (e.cash) parts.push(`${e.cash > 0 ? "+" : "−"}C$${Math.abs(e.cash).toLocaleString("en-US")}`);
  if (e.clout) parts.push(`${e.clout > 0 ? "+" : "−"}${Math.abs(e.clout).toLocaleString("en-US")} clout`);
  if (e.cents != null && (e.type === "purchase" || e.type === "renewal")) parts.push(`$${(e.cents / 100).toFixed(2)}`);
  return parts.join(" · ");
}

export function homeName(id: string | null | undefined): string | null {
  return home(id)?.name ?? null;
}
