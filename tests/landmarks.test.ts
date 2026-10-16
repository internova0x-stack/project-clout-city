import { test } from "node:test";
import assert from "node:assert/strict";
import { LANDMARKS, clearOfLandmarks, fitBridge, gridFacing, landmarkSites, streetsNear, onLandmarkSite, onStreet, placeLandmark, type RoadLine, type WaterArea } from "../lib/map/landmarks.ts";
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

test("landmarks turn to line up with the street grid, front still toward the camera", () => {
  // A grid turned 29 degrees: streets running at bearings 29 and 119.
  const line = (bearingDeg: number, offset: number): RoadLine => {
    const b = (bearingDeg * Math.PI) / 180;
    const pt = (d: number) => {
      const east = Math.sin(b) * d + Math.cos(b) * offset, north = Math.cos(b) * d - Math.sin(b) * offset;
      return [cafe.at[1] + east / (k * M), cafe.at[0] + north / M] as const;
    };
    return { major: false, pts: [pt(-200), pt(200)] };
  };
  const grid = [line(29, -60), line(29, 60), line(119, -60), line(119, 60)];
  const f = gridFacing(cafe, grid);
  assert.ok(Math.abs(f - 209) < 0.5, `facing ${f}`); // of 29, 119, 209, 299: the one nearest south
  assert.ok(Math.abs(((f - 180 + 540) % 360) - 180) <= 45, "still faces roughly south");
  assert.equal(gridFacing(cafe, []), cafe.facing, "no streets: keeps its facing");
  // Placement waits for the streets around it: none loaded yet, so it isn't placed (and stuck off the grid).
  assert.equal(streetsNear(cafe, []), false);
  assert.equal(streetsNear(cafe, grid), true);
  // A plain north-south grid keeps it facing south.
  assert.ok(Math.abs(gridFacing(cafe, [line(0, -60), line(90, 60)]) - 180) < 0.5);
});

/** Water east of a line `east` meters from the café (a river along the shore). */
const riverEast = (east: number): WaterArea => {
  const lng = cafe.at[1] + east / (k * M);
  return [[[lng, cafe.at[0] - 0.02], [lng + 0.02, cafe.at[0] - 0.02], [lng + 0.02, cafe.at[0] + 0.02], [lng, cafe.at[0] + 0.02], [lng, cafe.at[0] - 0.02]]];
};

test("a landmark by the water steps back onto land, its whole site", () => {
  const roads = [road(-200, 0, "ns", true), road(0, -150, "ew", false), road(0, 150, "ew", false)];
  // The shore 10 m east of its spot: half the site would be in the river.
  const at = placeLandmark(cafe, roads, [], [riverEast(10)]);
  const east = (at[1] - cafe.at[1]) * k * M;
  assert.ok(east + cafe.clear <= 10 + 4, `site reaches ${(east + cafe.clear).toFixed(1)} m east, the shore is at 10`);
  assert.deepEqual(placeLandmark(cafe, roads, [], [riverEast(200)]), cafe.at, "far from the water, it stays");
});

test("a pier park faces the water", () => {
  const pier = { ...LANDMARKS.find((l) => l.kind === "pier-park")!, at: cafe.at };
  const roads = [road(-80, 0, "ns", false), road(0, 60, "ew", false)];
  assert.equal(Math.round(gridFacing(pier, roads, 250, [riverEast(40)])), 90, "east, toward the river");
  assert.equal(Math.round(gridFacing(pier, roads)), 270, "no water: its own facing");
});

test("an elevated station sits on its street, along it, and clears only a strip", () => {
  const station = { ...LANDMARKS.find((l) => l.kind === "el-station")!, at: cafe.at };
  // A main road running north-south 30 m east, a side street 10 m north.
  const spot = onStreet(station, [road(30, 0, "ns", true), road(0, 10, "ew", false)])!;
  assert.ok(Math.abs((spot.at[1] - cafe.at[1]) * k * M - 30) < 0.5, "on the main road");
  assert.equal(Math.round(spot.facing!) % 180, 90, "its length runs north-south");
  assert.equal(onStreet(station, [road(300, 0, "ns", true)]), null, "no street near");
  const strip = clearOfLandmarks([{ ...station, facing: 90 }])[1] as [string, [string, GeoJSON.Geometry], number];
  assert.equal(strip[1][1].type, "LineString");
});
