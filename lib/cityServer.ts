import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bill, CityPlayer, CityState, DailyTask, GigOffer, PlayerItem } from "./cityState";

// Loads the signed-in player's city state. Runs the lazy daily tick first
// (sync_player), so bills, tasks and gig offers are current. Returns null when
// migration 0004 hasn't been applied yet, so the game still opens without it.
export async function loadCityState(supabase: SupabaseClient): Promise<CityState | null> {
  const { data: me, error } = await supabase.rpc("sync_player");
  if (error || !me) {
    if (error) console.warn("sync_player unavailable:", error.message);
    return null;
  }
  const player = me as CityPlayer & { id: string };
  const { data: today } = await supabase.rpc("ny_today");
  const day = today as string;
  const [tasks, gigs, bills, items, visits, attended, dev, layout] = await Promise.all([
    supabase.from("daily_tasks").select("id, slot, kind, place_id, action_id, reward, done_at").eq("ny_date", day).order("slot"),
    supabase
      .from("gig_offers")
      .select("id, ny_date, tier, title, pay, energy, wait_minutes, confidence_req, accepted_at, ready_at, collected_at")
      .or(`ny_date.eq.${day},and(accepted_at.not.is.null,collected_at.is.null)`)
      .order("id"),
    supabase.from("bills").select("id, kind, amount, due_date, status, paid_at").order("due_date", { ascending: false }).limit(30),
    supabase.from("player_items").select("id, sku, category, value, acquired, equipped").order("created_at"),
    supabase.from("place_visits").select("place_id, visits").eq("ny_date", day),
    supabase.from("event_attendance").select("event_id").eq("ny_date", day),
    supabase.from("game_settings").select("value").eq("key", "dev").maybeSingle(),
    // Migration 0006; missing until it runs, which just means the default layout.
    supabase.from("players").select("home_layout").eq("id", player.id).maybeSingle(),
  ]);
  const devValue = (dev.data?.value ?? {}) as { tools?: boolean; clockOffsetSeconds?: number };
  return {
    player: {
      id: player.id,
      bank_cash: player.bank_cash,
      clout: player.clout,
      energy: player.energy,
      mood: player.mood,
      confidence: player.confidence,
      home_id: player.home_id,
      next_rent_due: player.next_rent_due,
      next_phone_due: player.next_phone_due ?? null,
      next_car_due: player.next_car_due ?? null,
      house_sku: player.house_sku,
      car_sku: player.car_sku,
      car_mode: player.car_mode,
      purchases_count: player.purchases_count,
    },
    today: day,
    tasks: (tasks.data ?? []) as DailyTask[],
    gigs: (gigs.data ?? []) as GigOffer[],
    bills: (bills.data ?? []) as Bill[],
    items: (items.data ?? []) as PlayerItem[],
    visitsToday: Object.fromEntries(((visits.data ?? []) as { place_id: string; visits: number }[]).map((v) => [v.place_id, v.visits])),
    attendedToday: ((attended.data ?? []) as { event_id: string }[]).map((a) => a.event_id),
    clockOffsetSeconds: Number(devValue.clockOffsetSeconds ?? 0),
    devTools: devValue.tools === true,
    homeLayout: layout.error ? null : (layout.data as { home_layout: unknown } | null)?.home_layout ?? null,
  };
}
