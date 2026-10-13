import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bill, CityPlayer, CityState, DailyTask, GigOffer, PlayerItem } from "./cityState";
import type { LottoState } from "./lotto";

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
  // Migration 0033: draw any finished week's lotto jackpot (once; a no-op otherwise or before it runs).
  await supabase.rpc("lotto_settle");
  const day = today as string;
  const [tasks, gigs, bills, items, visits, attended, dev, layout, npc, rest, uses, lotto] = await Promise.all([
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
    // Migration 0016; missing until it runs, which just means the evergreen lines.
    supabase.rpc("npc_lines_live"),
    // Migration 0026; missing until it runs, which hides Nap and Sit.
    supabase.from("player_rest").select("kind, uses").eq("ny_date", day),
    // Migration 0031; missing until it runs, when boosts are once a day per place.
    supabase.from("action_uses").select("place_id, action_id").eq("ny_date", day),
    // Migration 0032; missing until it runs, which keeps Lucky Star's counter closed.
    supabase.rpc("lotto_state"),
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
      // Migration 0025; undefined before it runs, which keeps travel off.
      at_place: "at_place" in player ? player.at_place ?? null : undefined,
      // Migration 0027; undefined before it runs, which hides groceries and the kitchen.
      fridge_meals: "fridge_meals" in player ? Number(player.fridge_meals ?? 0) : undefined,
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
    npcLines: npc.error ? {} : ((npc.data ?? {}) as Record<string, string[]>),
    actionsToday: uses.error ? undefined : ((uses.data ?? []) as { place_id: string; action_id: string }[]).map((u) => `${u.place_id}:${u.action_id}`),
    lotto: lotto.error || !lotto.data ? undefined : (lotto.data as LottoState),
    restToday: rest.error ? undefined : Object.assign({ nap: 0, sit: 0 }, Object.fromEntries(((rest.data ?? []) as { kind: string; uses: number }[]).map((r) => [r.kind, r.uses]))),
  };
}
