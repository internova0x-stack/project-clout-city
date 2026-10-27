// PostHog analytics (owner, Oct 27): the custom events and the pure rules that find them in the game's state. No
// PostHog import here, so tests can run it; lib/analytics.ts sends what these return. Never put typed text (chat,
// letters, notes), emails or real names in a property.
import type { Bill, CityState } from "./cityState.ts";

export type AnalyticsEvent =
  | "signup_started"
  | "signup_completed"
  | "character_created"
  | "first_place_visited"
  | "daily_task_completed"
  | "all_daily_tasks_completed"
  | "rent_paid"
  | "rent_missed"
  | "event_attended"
  | "shop_item_bought"
  | "story_chapter_read"
  | "chat_message_sent"
  | "purchase_completed";

export type EventProps = Record<string, string | number | boolean | null>;
export interface Tracked { event: AnalyticsEvent; props: EventProps }

/** Pages that never send anything: the Story Studio and its preview (owner, Oct 27). */
export function analyticsOff(pathname: string): boolean {
  return /^\/studio(\/|$)/.test(pathname) || /^\/preview\/studio(\/|$)/.test(pathname);
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400e3);

/** Daily tasks that went from open to done between two states of the same day, and the day's sweep. */
export function taskEvents(prev: CityState | null, next: CityState): Tracked[] {
  if (!prev || prev.today !== next.today) return [];
  const out: Tracked[] = [];
  const before = new Map(prev.tasks.map((t) => [t.id, t]));
  for (const t of next.tasks) {
    if (!t.done_at || before.get(t.id)?.done_at !== null) continue;
    out.push({ event: "daily_task_completed", props: { task_kind: t.kind, place_id: t.place_id, action_id: t.action_id, reward: t.reward, slot: t.slot } });
  }
  const all = (s: CityState) => s.tasks.length > 0 && s.tasks.every((t) => t.done_at);
  if (all(next) && !all(prev)) out.push({ event: "all_daily_tasks_completed", props: { tasks: next.tasks.length, day: next.today } });
  return out;
}

/** Rent bills past their due date and still unpaid, not reported before (the caller keeps `seen`). */
export function missedRent(next: CityState, seen: ReadonlySet<number>): Tracked[] {
  return next.bills
    .filter((b) => b.kind === "rent" && b.status === "due" && b.due_date < next.today && !seen.has(b.id))
    .map((b) => ({ event: "rent_missed" as const, props: { bill_id: b.id, amount: b.amount, days_late: daysBetween(b.due_date, next.today), home_id: next.player.home_id ?? null } }));
}

/** A bill paid by payBill: rent_paid for rent (other bills aren't tracked). */
export function rentPaid(bill: Bill | undefined, next: CityState): Tracked[] {
  if (!bill || bill.kind !== "rent") return [];
  return [{ event: "rent_paid", props: { amount: bill.amount, days_late: Math.max(0, daysBetween(bill.due_date, next.today)), home_id: next.player.home_id ?? null } }];
}

/** A C$ Shop purchase: the price is what left the bank (buy or rent). */
export function shopBought(sku: string, mode: "buy" | "rent", prev: CityState | null, next: CityState, gainCash?: number): Tracked {
  const item = next.items.find((i) => i.sku === sku);
  const spent = gainCash !== undefined && gainCash < 0 ? -gainCash : prev ? prev.player.bank_cash - next.player.bank_cash : null;
  return { event: "shop_item_bought", props: { item: sku, category: item?.category ?? null, price: spent, currency: "C$", mode } };
}
