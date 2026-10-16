import { test } from "node:test";
import assert from "node:assert/strict";
import { LANDMARKS, fitBridge, landmarkSites, onLandmarkSite, placeLandmark, type RoadLine } from "../lib/map/landmarks.ts";
import { PLACES } from "../lib/city.ts";

const M = 111_320;
const cafe = LANDMARKS.find((l) => l.id === "grind-and-gossip")!;
const k = Math.cos((cafe.at[0] * Math.PI) / 180);
/** A straight road through a point offset (east, north meters) from the café, running north-south or east-west. */
const road = (east: number, north: number, dir: "ns" | "ew", major: boolean): RoadLine => {
  const lng = cafe.at[1] + east / (k * M), lat = cafe.at[0] + north / M;
  return { major, pts: dir === "ns" ? [[lng, lat - 0.01], [lng, lat + 0.01]] : [[lng - 0.01, lat], [lng + 0.01, lat]] };
};
const metersFrom = (a: readonly [number, number], b: readonly [number, number]) =>
  Math.hypot((a[1] - b[1]) * k * M, (a[0] - b[0]) * M);
const nearestMajor = (at: readonly [number, number], roads: RoadLine[]) => Math.min(...roads.filter((r) => r.major).map((r) => {
  const [p, q] = r.pts;
  return p[0] === q[0] ? Math.abs((at[1] - p[0]) * k * M) : Math.abs((at[0] - p[1]) * M);
}));

test("a landmark already inside a block stays put", () => {
  const roads = [road(-120, 0, "ns", true), road(120, 0, "ns", true), road(0, -100, "ew", false), road(0, 100, "ew", false)];
  assert.deepEqual(placeLandmark(cafe, roads), cafe.at);
});

test("a landmark standing on a main road moves off it, into the block", () => {
  const roads = [road(0, 0, "ns", true), road(160, 0, "ns", true), road(0, 90, "ew", false), road(0, -90, "ew", false)];
  const at = placeLandmark(cafe, roads);
  assert.ok(nearestMajor(at, roads) >= cafe.clear, `still ${nearestMajor(at, roads).toFixed(1)} m from a main road`);
  assert.ok(metersFrom(at, cafe.at) < 120, "moves only as far as it needs");
});

test("side streets are merged only when nothing nearby avoids them", () => {
  // A side street through the spot, and a clear block 60 m east.
  const roads = [road(0, 0, "ew", false), road(-50, 0, "ns", true), road(140, 0, "ns", true), road(0, 70, "ew", false)];
  const at = placeLandmark(cafe, roads);
  const north = (at[0] - cafe.at[0]) * M;
  assert.ok(Math.abs(north) >= cafe.clear - 0.5 && Math.abs(north - 70) >= cafe.clear - 0.5, "clears both side streets");
});

test("every landmark is a real place, and sites and traffic agree", () => {
  for (const l of LANDMARKS) {
    if (l.placeId) assert.ok(PLACES.some((p) => p.id === l.placeId), l.id);
    assert.equal(onLandmarkSite(l.at[1], l.at[0]), l.ground !== "none", l.id);
  }
  assert.equal(landmarkSites().features.length, LANDMARKS.filter((l) => l.ground !== "none").length);
});

test("a bridge stands where it is: no site, no moving", () => {
  const bridge = LANDMARKS.find((l) => l.kind === "bridge")!;
  const over = { major: true, pts: [[bridge.at[1] - 0.01, bridge.at[0]], [bridge.at[1] + 0.01, bridge.at[0]]] as const };
  assert.deepEqual(placeLandmark(bridge, [over]), bridge.at);
});

test("landmarks' sites don't overlap", () => {
  const sited = LANDMARKS.filter((l) => l.ground !== "none");
  for (const a of sited) for (const b of sited) {
    if (a === b) continue;
    const k = Math.cos((a.at[0] * Math.PI) / 180);
    const d = Math.hypot((a.at[1] - b.at[1]) * k * M, (a.at[0] - b.at[0]) * M);
    assert.ok(d > a.clear + b.clear, `${a.id} and ${b.id} are ${d.toFixed(0)} m apart`);
  }
});

test("a bridge fits its road: end to end, along the road", () => {
  const bridge = LANDMARKS.find((l) => l.kind === "bridge")!;
  const kb = Math.cos((bridge.at[0] * Math.PI) / 180);
  // A road 1,400 m long running east-southeast, centered 100 m north of the bridge's data spot.
  const pt = (east: number, north: number) => [bridge.at[1] + east / (kb * M), bridge.at[0] + (north + 100) / M] as const;
  const dir = [Math.sin((115 * Math.PI) / 180), Math.cos((115 * Math.PI) / 180)];
  const road: RoadLine = { major: true, bridge: true, pts: [-700, -350, 0, 350, 700].map((d) => pt(d * dir[0], d * dir[1])) };
  const fit = fitBridge(bridge, [road, { major: true, pts: [pt(0, 400), pt(50, 400)] }])!;
  assert.ok(Math.abs(fit.length! - 1400) < 1, `length ${fit.length}`);
  assert.ok(Math.abs(((fit.facing! - 90) % 180) - 115) < 0.5, `facing ${fit.facing}`);
  assert.ok(Math.abs((fit.at[0] - bridge.at[0]) * M - 100) < 1, "centered on the road");
  assert.equal(fitBridge(bridge, [{ major: true, pts: road.pts }]), null, "no bridge road, no fit");
});
