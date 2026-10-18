// Membership & purchases (owner, Oct 18): the player's VIP plan, what they've bought with real money, and the
// way into Stripe's billing portal (switch plan, update card, cancel, receipts). Safe to import anywhere.

export type VipPlan = "monthly" | "yearly";

export interface MembershipState {
  /** The VIP subscription as Stripe has it; null when the player isn't a VIP. */
  vip: {
    plan: VipPlan;
    /** cancelling: cancelled in the portal, VIP runs to the end of the paid period (owner, Oct 18). */
    status: "active" | "cancelling" | "past_due";
    /** The end of the paid period: the renewal date, or the day VIP ends when cancelling. */
    periodEnd: string;
    priceCents: number;
    currency: string;
  } | null;
  /** Chat forever (a one-off purchase): unlimited chat for good. */
  chatForever: boolean;
  /** Real-money purchases, newest first (renewals aren't listed; the portal has every invoice). */
  purchases: Purchase[];
  /** The player has paid Stripe before, so the billing portal has something to show. */
  canManage: boolean;
}

export interface Purchase {
  id: string;
  name: string;
  emoji: string;
  amountCents: number;
  currency: string;
  at: string;
  status: "paid" | "refunded";
}

export type MembershipResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface MembershipApi {
  state(): Promise<MembershipResult<MembershipState>>;
  /** A Stripe billing portal session for this player; the game then sends them to `url`. */
  portal(): Promise<MembershipResult<{ url: string }>>;
}

/** "Oct 3, 2027" (New York). */
export function membershipDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });
}

/** The plan's one-line status under its name. */
export function vipLine(vip: NonNullable<MembershipState["vip"]>, price: string): string {
  const per = vip.plan === "yearly" ? "year" : "month";
  if (vip.status === "cancelling") return `Cancelled · you're VIP until ${membershipDate(vip.periodEnd)}`;
  if (vip.status === "past_due") return "Your last payment didn't go through";
  return `Renews ${membershipDate(vip.periodEnd)} · ${price}/${per}`;
}
