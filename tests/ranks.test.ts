import { test } from "node:test";
import assert from "node:assert/strict";
import { RANKS, nextRank, nextRankLine, rankFor } from "../lib/ranks.ts";
import { CITY_ECONOMY, PLACES } from "../lib/city.ts";
import { ECONOMY } from "../lib/economy.ts";

test("ranks: ten, climbing on both ladders", () => {
  assert.equal(RANKS.length, 10);
  RANKS.forEach((r, i) => {
    assert.equal(r.level, i + 1);
    if (i) assert.ok(r.clout > RANKS[i - 1].clout && r.netWorth > RANKS[i - 1].netWorth, r.title);
  });
  assert.equal(RANKS[9].title, "God Status");
});

test("ranks: the clout steps are the game's gates", () => {
  const at = (title: string) => RANKS.find((r) => r.title === title)!.clout;
  assert.equal(at("Side Hustler"), CITY_ECONOMY.gigs.pro.clout, "pro gigs");
  assert.equal(at("On the List"), CITY_ECONOMY.gigs.big.clout, "big breaks");
  assert.equal(at("On the List"), PLACES.find((p) => p.id === "ultraviolet-society")!.club!.doorClout, "the exclusive door");
  assert.equal(at("Local Celebrity"), CITY_ECONOMY.clubs.vip.medium.freeClout, "free VIP at medium clubs");
  assert.equal(at("Nepo Baby Energy"), CITY_ECONOMY.clubs.vip.exclusive.freeClout, "free VIP everywhere");
});

test("ranks: the higher of clout or net worth, and what's next", () => {
  assert.equal(rankFor(0, ECONOMY.birthLottery.max).title, "Ramen Noodle Era", "everyone starts at the bottom");
  assert.equal(rankFor(2_000, 0).title, "On the List");
  assert.equal(rankFor(10, 1_000_000).title, "Nepo Baby Energy", "money gets you there too");
  assert.equal(rankFor(600_000, 0).title, "God Status");
  assert.equal(nextRank(600_000, 0), null);
  const n = nextRank(1_688, 210_000)!;
  assert.equal(n.rank.title, "On the List");
  assert.equal(n.clout, 312);
  assert.equal(n.netWorth, 40_000);
  assert.ok(n.progress > 0.68 && n.progress < 0.85);
  assert.equal(nextRankLine(1_688, 210_000), "312 clout or C$40,000 to On the List");
  assert.equal(nextRankLine(600_000, 0), "Top of the city. Nowhere left to climb.");
});
