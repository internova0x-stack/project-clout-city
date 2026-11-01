// The Player Economy (owner, Oct 31; docs/PLAYER-ECONOMY.md; migration 0151): value moves between players only as an item,
// a job's pay or (later) an asset, never as free cash. PLAYER_ECONOMY mirrors game_settings 'player_economy' (checked by
// tests/playerEconomy.test.ts); the database enforces every rule and the Studio can switch phases, so the game reads the
// live state from economy_state() and uses these numbers only to explain them. Safe to import anywhere.

export const PLAYER_ECONOMY = {
  /** Phase 1: gifts and player jobs. Phase 2: the item marketplace. Phase 3: business and property sales. */
  phases: { gifting: true, marketplace: false, assets: false },
  /** Which phase each kind of transfer belongs to. */
  kinds: { gift: "gifting", job: "gifting", trade: "marketplace", sale: "marketplace", asset: "assets" },
  /** To send value (gift, post a job, buy, swap, sell). Receiving needs only a home (owner, Nov 1). */
  unlock: { minAccountDays: 3, minRank: 2 },
  /** The city fee: a money sink, removed from the economy and shown up front. Gifts have none (the giver pays the Shop price). */
  fees: { gift: 0, job: 0.05, trade: 0.05, sale: 0.05, asset: 0.1 },
  /** Per New York week (Monday start), sent and received separately: the larger of min and
      earningsShare × the last earningsDays' cash earnings ÷ 4 (earnings leave out the kinds below). */
  weeklyCap: {
    min: 5000, earningsShare: 0.5, earningsDays: 28,
    notEarnings: ["job_pay", "job_cut", "job_refund", "gift_refund", "sale", "economy_fee", "market_sale", "asset_sale"],
  },
  /** C$ received from players (job pay; later sales) counts toward net worth only up to this much a week. */
  worthCap: { weekly: 5000 },
  /** Trades and sales (phases 2 and 3) stay within min to max × the reference value; within edge of either end is flagged. */
  band: { min: 0.5, max: 1.5, edge: 0.05 },
  /** A gift can't be sold back to the game, gifted on or traded for this long. */
  noResaleDays: 14,
  gifts: { perWeek: 5, messageMax: 140, expireDays: 7, headlineMin: 1000, categories: ["fashion", "accessories", "home", "luxury", "makeup"] },
  /** Game-verified jobs (post_task): errands and event support. */
  jobs: { payMin: 100, payMax: 5000, payChoices: [250, 500, 1000, 2500], hours: [6, 24, 72], errandPlaces: { min: 2, max: 4 }, clout: 10, trivialPerStep: 1000 },
  /** The automatic flags for the Studio's review queue. */
  flags: { pairTransfers: 3, pairDays: 7, newAccountDays: 14, newHeavyValue: 3000, trivialJobs: 2 },
} as const;

export type EconomyPhase = keyof typeof PLAYER_ECONOMY.phases;
export type EconomyKind = keyof typeof PLAYER_ECONOMY.kinds;
export type EconomyReason = "economy_frozen" | "too_new" | "economy_locked" | "no_player";

/** The city fee on an amount (floor, like economy_fee). */
export const economyFee = (kind: EconomyKind, amount: number) => Math.max(0, Math.floor(amount * PLAYER_ECONOMY.fees[kind]));

/** What the worker or seller keeps. */
export const afterFee = (kind: EconomyKind, amount: number) => amount - economyFee(kind, amount);

const money = (n: number) => `C$${Math.round(n).toLocaleString("en-US")}`;

/** "You get C$950 after the 5% city fee." */
export function feeLine(kind: EconomyKind, amount: number): string {
  const rate = PLAYER_ECONOMY.fees[kind];
  if (!rate) return `They get the full ${money(amount)}.`;
  return `You get ${money(afterFee(kind, amount))} after the ${Math.round(rate * 100)}% city fee.`;
}

/** The weekly cap for a player who earned this much cash in the last 28 days (economy_cap). */
export const weeklyCap = (earnings28: number) =>
  Math.max(PLAYER_ECONOMY.weeklyCap.min, Math.floor((Math.max(0, earnings28) * PLAYER_ECONOMY.weeklyCap.earningsShare) / 4));

/** The part of a week's C$ from players that net worth leaves out. */
export const uncountedFor = (earnedThisWeek: number) => Math.max(0, earnedThisWeek - PLAYER_ECONOMY.worthCap.weekly);

/** The price band around a reference value (economy_band). */
export function priceBand(reference: number): { min: number; max: number } {
  return { min: Math.ceil(reference * PLAYER_ECONOMY.band.min), max: Math.floor(reference * PLAYER_ECONOMY.band.max) };
}
export const inBand = (reference: number, price: number) => {
  const b = priceBand(reference);
  return reference > 0 && price >= b.min && price <= b.max;
};

/** Can this Shop item be bought as a gift (economy_giftable, minus "on sale", which the Shop already knows)? */
export function isGiftable(item: { price: number; category: string; collector?: boolean; reward?: boolean; storyOnly?: boolean }): boolean {
  return item.price > 0 && !item.collector && !item.reward && !item.storyOnly
    && (PLAYER_ECONOMY.gifts.categories as readonly string[]).includes(item.category);
}

// ---------------------------------------------------------------------------
// What the server sends
// ---------------------------------------------------------------------------
export interface EconomyState {
  phases: Record<EconomyPhase, boolean>;
  unlocked: boolean;
  reason: EconomyReason | null;
  unlocksAt: string;
  rank: number;
  /** On the open board: strangers who opted in too see your jobs (and later listings). */
  open: boolean;
  week: { start: string; cap: number; sent: number; received: number; giftsSent: number; giftsLeft: number };
  /** C$ from players that net worth leaves out (over the weekly cap). */
  uncounted: number;
}

export interface GiftCandidate { id: string; name: string; style: string; crew: boolean; partner: boolean; canReceive: boolean }

export interface IncomingGift {
  id: number; sku: string; name: string; value: number; message: string | null; createdAt: string; expiresAt: string;
  from: string; fromName: string; fromStyle: string;
}
export interface SentGift {
  id: number; sku: string; name: string; price: number; status: "pending" | "accepted" | "declined" | "expired"; createdAt: string;
  to: string; toName: string; toStyle: string;
}
export interface GiftInbox { incoming: IncomingGift[]; sent: SentGift[] }

/** One row of Trades & gifts (economy_history): gifts and jobs now, trades and sales in later phases. */
export interface EconomyRow {
  id: number;
  kind: "gift" | "job" | "trade" | "sale" | "asset";
  ref: string;
  label: string | null;
  value: number;
  fee: number;
  /** The other side got C$ (job pay, a sale), not an item. */
  cash: boolean;
  status: "done" | "reversed";
  at: string;
  direction: "sent" | "received";
  with: string | null;
  withName: string;
  withStyle: string | null;
}

/** "🎁 Gift to @tasha.b · Kitchen island" etc. */
export function historyLine(r: EconomyRow): { emoji: string; title: string; amount: string; note: string | null } {
  const who = `@${r.withName}`;
  // Phase 3 (migration 0153): business and property sales. The buyer sent the price; the seller got it minus the fee.
  if (r.kind === "asset") {
    const title = r.direction === "sent" ? `Bought from ${who}` : `Sold to ${who}`;
    return {
      emoji: "🔑", title: r.label ? `${title} · ${r.label}` : title,
      amount: r.direction === "sent" ? `−${money(r.value)}` : `+${money(r.value - r.fee)}`,
      note: r.status === "reversed" ? "Reversed" : r.fee > 0 && r.direction === "received" ? `${money(r.fee)} city fee` : null,
    };
  }
  const gift = r.kind === "gift";
  // Phase 2 (migration 0152): a sale is C$ for a piece; each side of a swap is a row of what went (Shop value).
  const swap = r.kind === "trade";
  const title = gift
    ? (r.direction === "sent" ? `Gift to ${who}` : `Gift from ${who}`)
    : r.kind === "job" ? (r.direction === "sent" ? `Hired ${who}` : `Worked for ${who}`)
    : r.kind === "sale" ? (r.direction === "sent" ? `Bought from ${who}` : `Sold to ${who}`)
    : swap ? (r.direction === "sent" ? `Swapped away to ${who}` : `Swapped in from ${who}`)
    : r.direction === "sent" ? `To ${who}` : `From ${who}`;
  const amount = gift || swap ? money(r.value) : r.direction === "sent" ? `−${money(r.value)}` : `+${money(r.value - r.fee)}`;
  const note = r.status === "reversed" ? (r.kind === "sale" || swap ? "Reversed by the city" : "Sent back")
    : swap ? "Shop value" : r.fee > 0 && r.direction === "received" ? `${money(r.fee)} city fee` : null;
  return { emoji: gift ? "🎁" : r.kind === "job" ? "💼" : r.kind === "sale" ? "🏷️" : "🔁", title: r.label ? `${title} · ${r.label}` : title, amount, note };
}

/** Why the player can't trade yet, in words. */
export function lockedLine(s: Pick<EconomyState, "reason" | "unlocksAt"> | null): string | null {
  if (!s?.reason) return null;
  if (s.reason === "too_new") {
    const d = Math.max(1, Math.ceil((new Date(s.unlocksAt).getTime() - Date.now()) / 86_400_000));
    return `Sending gifts and posting jobs open ${d === 1 ? "tomorrow" : `in ${d} days`}. You can already receive gifts and take jobs.`;
  }
  if (s.reason === "economy_locked") return "Sending gifts and posting jobs open at Rank 2. You can already receive gifts and take jobs.";
  if (s.reason === "economy_frozen") return "Your trading is paused while the city takes a look. Write to the Mayor if that's a mistake.";
  return null;
}

/** Player-facing words for the server's refusals (gifts, jobs, the core). */
export function economyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate_limited")) return "Whoa, slow down. The city needs a minute to catch up.";
  if (m.includes("phase_off")) return "That's switched off for now. The city is recalibrating its generosity.";
  if (m.includes("economy_frozen")) return lockedLine({ reason: "economy_frozen", unlocksAt: "" })!;
  if (m.includes("too_new")) return `Sending opens once your account is ${PLAYER_ECONOMY.unlock.minAccountDays} days old. Receiving and taking jobs already work.`;
  if (m.includes("economy_locked")) return "Sending opens at Rank 2. Receiving and taking jobs already work.";
  if (m.includes("their_weekly_limit")) return "They've had enough generosity for one week. Try again Monday.";
  if (m.includes("weekly_limit")) return "That's over your weekly limit for gifts and jobs. It resets Monday.";
  if (m.includes("they_cant_receive")) return "They can't receive gifts right now.";
  if (m.includes("not_friends")) return "Only your Crew, your partner and people you've chatted with.";
  if (m.includes("not_giftable")) return "That one can't be gifted. Real-money pieces, rewards, cars and houses stay with their owner.";
  if (m.includes("they_own_it")) return "They already have one. Or one's already on its way.";
  if (m.includes("they_need_clout")) return "They don't have the clout to wear that yet. Awkward for everyone.";
  if (m.includes("gift_limit")) return `That's ${PLAYER_ECONOMY.gifts.perWeek} gifts this week. Generosity resets Monday.`;
  if (m.includes("message_too_long")) return `Keep the note under ${PLAYER_ECONOMY.gifts.messageMax} characters.`;
  if (m.includes("own_gift")) return "Treat yourself in the Shop instead.";
  if (m.includes("gift_gone")) return "That gift isn't waiting anymore.";
  if (m.includes("already_owned")) return "You already own one of those.";
  if (m.includes("no_resale")) return `Gifts stay with you for ${PLAYER_ECONOMY.noResaleDays} days. Regifting is a whole thing.`;
  if (m.includes("cant_afford")) return "Not enough cash for that.";
  if (m.includes("not_for_sale")) return "The Shop stopped selling that one.";
  if (m.includes("couples_only")) return "That's a couples piece: they'd need to be dating someone.";
  return "That didn't work. Try again.";
}

/** What the game calls: app/home/economyActions.ts on the server, lib/economySim.ts in the preview. */
export type EconomyResult<T> = { ok: true; data: T } | { ok: false; error: string };
export interface EconomyApi {
  state(): Promise<EconomyResult<EconomyState>>;
  setOpen(open: boolean): Promise<EconomyResult<EconomyState>>;
  history(): Promise<EconomyResult<EconomyRow[]>>;
  candidates(): Promise<EconomyResult<GiftCandidate[]>>;
  inbox(): Promise<EconomyResult<GiftInbox>>;
  send(to: string, sku: string, message: string): Promise<EconomyResult<{ id: number; cash: number }>>;
  answer(id: number, accept: boolean): Promise<EconomyResult<{ status: string; back?: "item" | "cash" }>>;
}

// ---------------------------------------------------------------------------
// Studio: the Economy tab (admin_economy)
// ---------------------------------------------------------------------------
export type FlagRule = "repeat_pair" | "new_heavy" | "trivial_jobs" | "band_edge"
  // Phase 2 (migration 0152).
  | "sku_limit"
  // Phase 3 (migration 0153).
  | "asset_new_buyer";
export type FlagOutcome = "cleared" | "noted" | "frozen";

/** Plain words for the owner. */
export const FLAG_COPY: Record<FlagRule, { title: string; line: string }> = {
  repeat_pair: { title: "Same two players, again and again", line: `${PLAYER_ECONOMY.flags.pairTransfers}+ gifts or jobs between the same pair in ${PLAYER_ECONOMY.flags.pairDays} days. Could be besties, could be a second account feeding a first.` },
  new_heavy: { title: "New account moving a lot", line: `An account under ${PLAYER_ECONOMY.flags.newAccountDays} days old sent or received C$${PLAYER_ECONOMY.flags.newHeavyValue.toLocaleString("en-US")}+ in a week.` },
  trivial_jobs: { title: "Big pay for tiny jobs", line: `The same client paid the same worker over C$${PLAYER_ECONOMY.jobs.trivialPerStep.toLocaleString("en-US")} a step, ${PLAYER_ECONOMY.flags.trivialJobs}+ times in a week. Possibly cash in a job costume.` },
  band_edge: { title: "Price at the edge of the band", line: "A trade priced right at the bottom or top of what's allowed. Worth a look." },
  // Phase 2 (migration 0152).
  sku_limit: { title: "Buying up one item", line: "Hit the weekly limit on one Shop item from the Market (bought or swapped for). Could be a collector, could be someone cornering the sofa market." },
  // Phase 3 (migration 0153).
  asset_new_buyer: { title: "New account buying a business or a house", line: "An account under 14 days old said yes to an asset sale. Brand-new tycoons are rare; brand-new second accounts aren't." },
};

export interface EconomyFlag {
  id: number;
  rule: FlagRule;
  ref: string;
  detail: Record<string, number>;
  status: "open" | "reviewed";
  outcome: FlagOutcome | null;
  note: string | null;
  createdAt: string;
  reviewedAt: string | null;
  players: { id: string; name: string; joined: string; frozen: boolean }[];
}

export interface EconomyAdmin {
  settings: Omit<typeof PLAYER_ECONOMY, "phases"> & { phases: Record<EconomyPhase, boolean> };
  week: { start: string; transfers: number; value: number; fees: number; gifts: number; jobs: number };
  flags: EconomyFlag[];
  frozen: { id: string; name: string; at: string; reason: string | null }[];
}

export const PHASE_COPY: Record<EconomyPhase, { title: string; line: string; built: boolean }> = {
  gifting: { title: "Phase 1 · Gifts and player jobs", line: "Buying Shop items for friends; the Jobs board with escrow, errands and event support.", built: true },
  marketplace: { title: "Phase 2 · Item marketplace", line: "Listings, swaps in the trade window, and underworld runners between players.", built: true },
  assets: { title: "Phase 3 · Business and property sales", line: "Selling a business or a home to another player, with a cooling-off day.", built: true },
};
