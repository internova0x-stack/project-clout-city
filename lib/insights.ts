// Insights (migration 0053): what admin_insights() returns, and small helpers for the Studio tab.
// Safe to import anywhere.

export interface InsightsDay { date: string; signups: number; active: number; revenueCents: number; avgSessionSeconds: number }
export interface InsightsCohort { week: string; size: number; d1: number; d1Eligible: number; d7: number; d7Eligible: number; d30: number; d30Eligible: number }

/** Careers part 3 (migration 0143, admin_career_stats): how jobs are going; null before the migration. */
export interface CareerStats {
  days: number; hired: number; cohort14: number; kept14: number; promoted: number;
  working: Partial<Record<"hospitality" | "tech" | "media" | "cityhall", number>>;
  aspirations: Record<string, number>;
}

export interface Insights {
  careers?: CareerStats | null;
  days: number;
  today: string;
  totals: {
    players: number; accounts: number;
    signupsToday: number; signups7: number; signupsPeriod: number;
    activeToday: number; active7: number; active30: number; activePeriod: number;
    revenueCents: number; revenuePeriodCents: number; revenue7Cents: number;
    payers: number; vipMembers: number; chatForever: number; refunds: number;
    sessionsPeriod: number; avgSessionSeconds: number; medianSessionSeconds: number;
    sessionsPerActiveDay: number; minutesPerActiveDay: number;
  };
  daily: InsightsDay[];
  retention: Record<"d1" | "d7" | "d30", { cohort: number; returned: number }>;
  cohorts: InsightsCohort[];
  funnel: { step: string; n: number }[];
  features: { feature: string; players: number }[];
  spending: { type: string; count: number; cents: number; buyers: number }[];
  topProducts: { sku: string; name: string; count: number; cents: number }[];
  ranks: { level: number; players: number }[];
  economy: { medianCash: number; medianClout: number };
}

/** "4m 12s", "38s", "1h 5m". */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

/** "38%", "<1%" for a few, or a dash when there's nobody to count yet. */
export function share(n: number, of: number): string {
  if (of <= 0) return "–";
  const pct = (100 * n) / of;
  return n > 0 && pct < 0.5 ? "<1%" : `${Math.round(pct)}%`;
}

export const PRODUCT_LABEL: Record<string, string> = {
  chat_pass: "VIP and chat forever", side_arc: "Side stories", exclusive_event: "Exclusive parties",
  collector_item: "Collector pieces", postcard: "Postcards", other: "Other",
};
