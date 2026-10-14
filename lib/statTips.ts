// #3 (owner, Oct 14): "the options should change according to the context. If I'm at home, the best
// thing to do is take a nap. Also these actions should have effects such as the timer tied to them."
// One suggestion per stat, picked for where the player is, with its effect, its time and its limit.
import { actionSeconds } from "./actionTime.ts";
import { CITY_ECONOMY, type Place } from "./city.ts";
import { cookAvailability, restAvailability, type CityState } from "./cityState.ts";
import { formatCash } from "./economy.ts";
import { statTips, type StatKey, type StatTip } from "./recent.ts";

const NAME: Record<StatKey, string> = { energy: "Energy", mood: "Mood", confidence: "Confidence" };

const line = (gain: number, stat: StatKey, price: number, seconds: number, limit?: string) =>
  [`+${gain} ${NAME[stat]}`, price > 0 ? formatCash(price) : "Free", seconds > 0 ? `⏱ ${seconds}s` : null, limit ?? null].filter(Boolean).join(" · ");

/** At home: a nap, then cooking, then sitting for Energy; sitting for Mood. Rest ids are "rest:nap", "rest:sit", "cook". */
function homeTip(stat: StatKey, s: CityState, restOn: boolean, kitchenOn: boolean): StatTip | null {
  if (!restOn || (s.player.at_place ?? null) !== null) return null;
  const rest = (kind: "nap" | "sit"): StatTip | null => {
    const r = CITY_ECONOMY.rest[kind];
    const gain = stat === "energy" ? r.energy : stat === "mood" ? r.mood : 0;
    const av = restAvailability(kind, s);
    if (!av.ok || gain <= 0) return null;
    return {
      stat, placeId: `rest:${kind}`, placeName: kind === "nap" ? "Take a nap" : "Sit a while", emoji: kind === "nap" ? "😴" : "🛋️",
      price: 0, gain, go: kind === "nap" ? "Nap" : "Sit",
      detail: line(gain, stat, 0, r.seconds, `${av.perDay - av.used} of ${av.perDay} left today`),
    };
  };
  if (stat === "energy") {
    const cook = CITY_ECONOMY.groceries.cook;
    const meals = s.player.fridge_meals ?? 0;
    return rest("nap")
      ?? (kitchenOn && cookAvailability(s).ok
        ? { stat, placeId: "cook", placeName: "Cook a meal", emoji: "🍳", price: 0, gain: cook.energy, go: "Cook",
            detail: line(cook.energy, stat, 0, cook.seconds, `${meals} meal${meals === 1 ? "" : "s"} in the fridge`) }
        : null)
      ?? rest("sit");
  }
  if (stat === "mood") return rest("sit");
  return null;
}

/** Out and about: something here first (no travel), else the cheapest place that raises it. */
function placeTip(stat: StatKey, places: readonly Place[], s: CityState): StatTip | null {
  const here = s.player.at_place ? places.filter((p) => p.id === s.player.at_place) : [];
  const tip = (here.length ? statTips(here, s.player.bank_cash)[stat] : null) ?? statTips(places, s.player.bank_cash)[stat];
  if (!tip) return null;
  const place = places.find((p) => p.id === tip.placeId);
  const action = place?.actions.find((a) => (a.price ?? 0) === tip.price && (stat === "energy" ? -a.energy : stat === "mood" ? a.mood ?? 0 : a.confidence ?? 0) === tip.gain);
  const isHere = tip.placeId === s.player.at_place;
  return {
    ...tip,
    placeName: isHere ? `${action?.label ?? tip.placeName} here` : tip.placeName,
    go: isHere ? "Do it" : "Go",
    detail: line(tip.gain, stat, tip.price, action ? actionSeconds(action) : 0, isHere ? undefined : "Travel first"),
  };
}

export function contextTips(places: readonly Place[], s: CityState, opts: { restOn: boolean; kitchenOn: boolean }): Record<StatKey, StatTip | null> {
  const pick = (stat: StatKey) => homeTip(stat, s, opts.restOn, opts.kitchenOn) ?? placeTip(stat, places, s);
  return { energy: pick("energy"), mood: pick("mood"), confidence: pick("confidence") };
}
