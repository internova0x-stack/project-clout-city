# Avatar models

Quaternius, **Ultimate Modular Men** and **Ultimate Modular Women** packs (quaternius.com), licensed
**CC0 1.0** (public domain). Thank you, Quaternius.

Built by `node scripts/build-avatar-assets.mjs <men glTF folder> <women glTF folder>` from the packs'
"Individual Characters/glTF" folders: props removed (pistols, sword, backpack), meshes quantized,
and the shared animations (Idle, Idle_Neutral, Walk, Run, Wave, Interact) stored once per body type
in `m/_anims.glb` and `f/_anims.glb`.

Which parts the game uses for each Look and Shop piece: `lib/avatarCatalog.ts`.

## The new base bodies (`body/`)

Made from the owner's bald, barefoot bodies (listed in `assets/avatar-animations.json`, downloaded by
`npm run avatars:fetch` into `assets/avatars/sources/`, never committed) by `npm run avatars:build`: `m.glb` and `f.glb`
(full detail), `m-low.glb`, `f-low.glb` (low graphics), and `m-anims.glb`, `f-anims.glb`: the walk and every clip
(idle, run, sit, sleep, dance, wave) retargeted onto the body's skeleton (`scripts/retarget.mjs`). One skinned mesh each,
a 24-bone skeleton. Used by `components/avatar/baseAvatar.ts` while the new-bodies switch is on (`lib/graphics.ts`).

## Garment templates (`garments/`)

Cut from the same bodies by `scripts/garments.mjs` and `scripts/wardrobe.mjs` (run by the build): every top, bottom,
the boots and the sneakers, for each body, in full and low detail, on the body's own skeleton. Worn by
`components/avatar/baseAvatar.ts` (`GARMENT_TEMPLATES` in `lib/avatarCatalog.ts`).

## Hair (`hair/`)

Every hairstyle for each body, grown from the body's scalp by `scripts/hair.mjs` (run by the build): one skinned mesh
per style (`short`, `buzz`, `long`, ...) and one for its lengths (`long-lengths`, `ponytail-lengths`, ...).
