// The owner's avatar cast in gold, frozen mid-wave: Clout Couture's Self-Portrait Statue at home (components/room/Room3D.tsx)
// and the Plaza Statue in front of the Unisphere (components/map/coutureModels.ts).

import { type Mesh, MeshStandardMaterial } from "three";
import type { AvatarParts } from "./buildAvatar";
import { buildModelAvatar } from "./modelAvatar";

/**
 * Clout Couture's Self-Portrait Statue: the player's avatar on the pedestal, frozen mid-wave, every surface solid gold
 * (one plain metal material, so the fabrics' patterns and the body type's widening give way to a smooth casting).
 */
export function goldStatue(look: Parameters<typeof buildModelAvatar>[0], outfit: NonNullable<Parameters<typeof buildModelAvatar>[1]>["outfit"]): AvatarParts {
  const parts = buildModelAvatar(look, { outfit, pedestal: false });
  parts.root.scale.setScalar(0.82);
  parts.root.visible = false;
  const gold = new MeshStandardMaterial({ color: "#F0C850", metalness: 0.55, roughness: 0.3, emissive: "#4A3500", emissiveIntensity: 0.6 });
  void (parts.ready ?? Promise.resolve()).then(() => {
    parts.play?.("wave");
    parts.update?.(0.75);
    parts.root.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) { m.material = gold; m.castShadow = true; }
    });
    parts.root.visible = true;
  });
  const dispose = parts.dispose.bind(parts);
  return { ...parts, dispose: () => { dispose(); gold.dispose(); } };
}
