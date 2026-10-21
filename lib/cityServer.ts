import type { CatalogItem } from "./shopCatalog";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bill, CityPlayer, CityState, DailyTask, GigOffer, PlayerItem, StyleState } from "./cityState";
import type { LottoState } from "./lotto";
import type { PerksState } from "./skills";
import type { CalendarState } from "./calendar";
import NPCS from "../content/culture/npcs.json";

/** C2: places whose person remembers you after a few different days (content/culture/npcs.json "remembers"). */
const REMEMBER_PLACES = NPCS.profiles.filter((p) => "remembers" in p && p.remembers).map((p) => p.placeId);

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
  const [tasks, gigs, bills, items, visits, attended, dev, layout, npc, rest, uses, lotto, perks, days, calendar, catalog, style] = await Promise.all([
    supabase.from("daily_tasks").select("*").eq("ny_date", day).order("slot"),
    supabase
      .from("gig_offers")
      .select("id, ny_date, tier, title, pay, energy, wait_minutes, confidence_req, accepted_at, ready_at, collected_at")
      .or(`ny_date.eq.${day},and(accepted_at.not.is.null,collected_at.is.null)`)
      .order("id"),
    supabase.from("bills").select("id, kind, amount, due_date, status, paid_at").order("due_date", { ascending: false }).limit(30),
    // "*": options (migration 0103) arrives once it has run.
    supabase.from("player_items").select("*").order("created_at"),
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
    // Migration 0092; missing until it runs, which hides skill gigs and invites.
    supabase.rpc("skill_perks_state"),
    // C2: one place_visits row per place per New York day, so rows are days.
    supabase.from("place_visits").select("place_id").in("place_id", REMEMBER_PLACES),
    // Migration 0096; missing until it runs, which hides calendar attendance and gift boxes.
    supabase.rpc("calendar_state"),
    // Migration 0099; missing until it runs, when the Shop shows the code's list as before.
    supabase.rpc("shop_catalog_public"),
    // Migration 0100; missing until it runs, which hides style looks and their venue boost.
    supabase.rpc("style_state"),
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
      // Migration 0045; undefined before it runs, which hides the Apartments app.
      moved_up: "moved_up" in player ? !!player.moved_up : undefined,
      // Migration 0095; undefined before it runs, which hides the OMG Card.
      transit_pass_until: "transit_pass_until" in player ? player.transit_pass_until ?? null : undefined,
    },
    today: day,
    tasks: (tasks.data ?? []) as DailyTask[],
    gigs: (gigs.data ?? []) as GigOffer[],
    bills: (bills.data ?? []) as Bill[],
    items: ((items.data ?? []) as (PlayerItem & { options?: PlayerItem["options"] })[]).map((i) => ({
      id: i.id, sku: i.sku, category: i.category, value: i.value, acquired: i.acquired, equipped: i.equipped,
      ...(i.options && Object.keys(i.options).length ? { options: i.options } : {}),
    })),
    regularDays: ((days.data ?? []) as { place_id: string }[]).reduce<Record<string, number>>((m, v) => ({ ...m, [v.place_id]: (m[v.place_id] ?? 0) + 1 }), {}),
    visitsToday: Object.fromEntries(((visits.data ?? []) as { place_id: string; visits: number }[]).map((v) => [v.place_id, v.visits])),
    attendedToday: ((attended.data ?? []) as { event_id: string }[]).map((a) => a.event_id),
    clockOffsetSeconds: Number(devValue.clockOffsetSeconds ?? 0),
    devTools: devValue.tools === true,
    homeLayout: layout.error ? null : (layout.data as { home_layout: unknown } | null)?.home_layout ?? null,
    npcLines: npc.error ? {} : ((npc.data ?? {}) as Record<string, string[]>),
    actionsToday: uses.error ? undefined : ((uses.data ?? []) as { place_id: string; action_id: string }[]).map((u) => `${u.place_id}:${u.action_id}`),
    lotto: lotto.error || !lotto.data ? undefined : (lotto.data as LottoState),
    perks: perks.error || !perks.data ? undefined : (perks.data as PerksState),
    calendar: calendar.error || !calendar.data ? undefined : (calendar.data as CalendarState),
    catalog: catalog.error || !Array.isArray(catalog.data) ? undefined : (catalog.data as CatalogItem[]),
    style: style.error || !style.data ? undefined : (style.data as StyleState),
    restToday: rest.error ? undefined : Object.assign({ nap: 0, sit: 0 }, Object.fromEntries(((rest.data ?? []) as { kind: string; uses: number }[]).map((r) => [r.kind, r.uses]))),
  };
}
