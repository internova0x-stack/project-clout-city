# Avatar models

Quaternius, **Ultimate Modular Men** and **Ultimate Modular Women** packs (quaternius.com), licensed
**CC0 1.0** (public domain). Thank you, Quaternius.

Built by `node scripts/build-avatar-assets.mjs <men glTF folder> <women glTF folder>` from the packs'
"Individual Characters/glTF" folders: props removed (pistols, sword, backpack), meshes quantized,
and the shared animations (Idle, Idle_Neutral, Walk, Run, Wave, Interact) stored once per body type
in `m/_anims.glb` and `f/_anims.glb`.

Which parts the game uses for each Look and Shop piece: `lib/avatarCatalog.ts`.

## The new base bodies (`body/`)

Made from the owner's bald masters in `assets/avatars/` by `node scripts/build-base-avatars.mjs`: `m.glb` and `f.glb`
(full detail) and `m-low.glb`, `f-low.glb` (low graphics). One skinned mesh each, a 24-bone skeleton and a walk.
Used by `components/avatar/baseAvatar.ts` while the new-bodies switch is on (`lib/graphics.ts`).
