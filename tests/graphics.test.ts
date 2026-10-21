import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { lowGraphics, newBodies, renderQuality, weakDevice } from "../lib/graphics.ts";

test("only clearly weak phones get low graphics by themselves", () => {
  assert.equal(weakDevice({ deviceMemory: 2, hardwareConcurrency: 8 }), true);
  assert.equal(weakDevice({ hardwareConcurrency: 2 }), true);
  assert.equal(weakDevice({ hardwareConcurrency: 4 }), false, "Safari reports 4 cores on fast iPhones");
  assert.equal(weakDevice({ deviceMemory: 4, hardwareConcurrency: 8 }), false);
  assert.equal(weakDevice({}), false);
  assert.equal(weakDevice(undefined), false);
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
