import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { frameWatch, lowGraphics, newBodies, renderQuality, weakDevice } from "../lib/graphics.ts";

test("only clearly weak phones get low graphics by themselves", () => {
  assert.equal(weakDevice({ deviceMemory: 2, hardwareConcurrency: 8 }), true);
  assert.equal(weakDevice({ hardwareConcurrency: 2 }), true);
  assert.equal(weakDevice({ hardwareConcurrency: 4 }), false, "Safari reports 4 cores on fast iPhones");
  assert.equal(weakDevice({ deviceMemory: 4, hardwareConcurrency: 8 }), false);
  assert.equal(weakDevice({}), false);
  assert.equal(weakDevice(undefined), false);
});

test("the frame watch calls a phone slow once, after settling, from the middle frame time", () => {
  const run = (gap: number, n = 200, spikes = 0) => {
    const w = frameWatch({ settleMs: 1000, samples: 60, slowMs: 45 });
    const said: string[] = [];
    let t = 0;
    for (let i = 0; i < n; i++) { t += i < spikes ? 2000 : gap; const r = w(t); if (r) said.push(r); }
    return said;
  };
  assert.deepEqual(run(16.7), ["ok"], "60 fps is fine");
  assert.deepEqual(run(33.4), ["ok"], "30 fps is fine");
  assert.deepEqual(run(70), ["slow"], "14 fps is too slow");
  assert.deepEqual(run(70, 30), [], "not enough frames yet: no verdict");
  assert.deepEqual(run(16.7, 200, 20), ["ok"], "pauses over a second (a hidden tab) don't count");
  // One long hitch among fast frames (a landmark being built) doesn't make a phone slow.
  const w = frameWatch({ settleMs: 0, samples: 60 });
  let t = 0, said: string | null = null;
  for (let i = 0; i < 80 && !said; i++) { t += i % 10 === 0 ? 400 : 16; said = w(t); }
  assert.equal(said, "ok");
});

test("on the server (no browser) the defaults are full graphics and the new bodies", () => {
  assert.equal(lowGraphics(), false);
  assert.equal(newBodies(), true, "the new bodies are on for everyone (stage 4's switch-on)");
  assert.deepEqual(renderQuality(), { pixelRatio: 1, shadows: true, antialias: true });
});

test("every base body ships in full and low detail, and stays small", () => {
  for (const sex of ["m", "f"]) {
    for (const low of ["", "-low"]) {
      const p = `public/avatars/body/${sex}${low}.glb`;
      assert.ok(existsSync(p), p);
      assert.ok(statSync(p).size < (low ? 450_000 : 700_000), `${p} is ${statSync(p).size} bytes`);
    }
  }
});

test("each body has one animation file: the walk and every clip in assets/avatar-animations.json, on its skeleton", async () => {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS as never);
  const spec = JSON.parse(readFileSync("assets/avatar-animations.json", "utf8"));
  for (const [sex, body] of [["m", "male"], ["f", "female"]]) {
    const p = `public/avatars/body/${sex}-anims.glb`;
    assert.ok(statSync(p).size < 500_000, `${p} is ${statSync(p).size} bytes`);
    const anims = (await io.read(p)).getRoot();
    const want = ["walk", ...spec.clips.filter((c: { body: string }) => c.body === body).map((c: { name: string }) => c.name)];
    assert.deepEqual(anims.listAnimations().map((a) => a.getName()).sort(), want.sort(), `${sex}: clips`);
    assert.equal(anims.listMeshes().length, 0, `${sex}: no body in the animation file`);
    // Every channel drives a bone of the body (by name), and only the hips move.
    const bones = new Set((await io.read(`public/avatars/body/${sex}.glb`)).getRoot().listSkins()[0].listJoints().map((j) => j.getName()));
    for (const a of anims.listAnimations()) for (const c of a.listChannels()) {
      assert.ok(bones.has(c.getTargetNode()!.getName()), `${sex} ${a.getName()}: ${c.getTargetNode()!.getName()} is a bone of the body`);
      if (c.getTargetPath() === "translation") assert.equal(c.getTargetNode()!.getName(), "Hips");
    }
  }
});
