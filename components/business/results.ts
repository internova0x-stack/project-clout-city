// Businesses' end states as celebrations (components/Celebrate.tsx; owner, Nov 4). GameShell calls these after the server
// answers (business.upgrade / business.goPublic); the server decided every amount, these only describe the new level.
//   an upgrade bought                 a banner: the upgrade, the new pay a day (and "Fully upgraded" on the third)
//   going public                      the legend: only the last business on the ladder can ring the bell, so going
//                                     public is the top of the ladder; a takeover if a lower rung ever gets an IPO

import { BUSINESSES, businessById, businessValue, money, payPerDay } from "../../lib/businesses.ts";
import { CITY_ECONOMY } from "../../lib/city.ts";
import type { Celebration } from "../Celebrate.tsx";

/** After `business.upgrade(id)` answered with the new level (1 to 3). */
export function upgradeBanner(id: string, level: number, onOpen?: () => void): Celebration | null {
  const b = businessById(id);
  const u = b?.upgrades[level - 1];
  if (!b || !u) return null;
  const top = level >= b.upgrades.length;
  return { rung: 2, emoji: u.emoji, tag: top ? `${b.name} · Fully upgraded` : `${b.name} · Upgrade ${level} of ${b.upgrades.length}`, title: u.name,
    rewards: [{ tone: "cash", text: `${money(payPerDay(b, level))} a day` }, { text: `📈 +${Math.round(CITY_ECONOMY.businesses.upgrade.value * 100)}% worth` }],
    onCta: onOpen };
}

/** After `business.goPublic()` succeeded. `worthBefore` is the player's net worth read before the bell (the company's
 *  jump is added here, so the card needn't wait for a re-render). */
export function publicCelebration(id: string, clout: number, worthBefore: number, name: string): Celebration | null {
  const b = businessById(id);
  if (!b) return null;
  const times = CITY_ECONOMY.businesses.goPublic.times;
  const top = b.id === BUSINESSES[BUSINESSES.length - 1].id;
  const value = businessValue(b, b.upgrades.length, true, clout);
  const worth = worthBefore + value - businessValue(b, b.upgrades.length, false, clout);
  const line = "Your app for apps is worth three times as much now. Nobody can explain why, least of all the analysts.";
  const rewards = [{ tone: "cash" as const, text: `${b.emoji} ${money(value)} company` }, { text: `💼 Net worth ${money(worth)}` }];
  const share = `${name} just took ${b.name} public in Clout City. Ding ding.`;
  if (top) {
    return { rung: 4, emoji: "🔔", tag: "Went public", num: `×${times}`, unit: "worth overnight", art: "stage",
      title: "You rang the bell", line, rewards, share, cta: "Act humble" };
  }
  return { rung: 3, emoji: "🔔", tag: `${b.name} is public`, art: "stage", twist: "register", title: "You rang the bell", line, rewards,
    lola: "A ticker symbol and still no business model. Iconic.", share, cta: "Act humble" };
}
