// Performance (owner, Oct 16: "the device started heating up"): a landmark is built from hundreds of
// small meshes, and every mesh is a draw call, every frame. This bakes a model's still parts into
// one mesh per material, so a landmark costs a handful of draw calls instead of hundreds. Parts that
// change (night-only glows, searchlights) stay as they are.

import { BufferAttribute, BufferGeometry, type Material, Matrix4, Mesh, MeshStandardMaterial, type Object3D } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Materials that look the same can share a draw call; a material whose glow changes keeps its own. */
function materialKey(m: Material, own: ReadonlySet<Material>): string {
  if (own.has(m) || !(m instanceof MeshStandardMaterial)) return m.uuid;
  return [
    m.color.getHexString(), m.emissive.getHexString(), m.emissiveIntensity, m.roughness, m.metalness, m.side,
    m.transparent, m.opacity, m.flatShading, m.vertexColors, m.map?.uuid ?? "", m.emissiveMap?.uuid ?? "",
  ].join("|");
}

/** One group of a multi-material geometry, as its own (non-indexed) geometry. */
function slice(geo: BufferGeometry, start: number, count: number): BufferGeometry {
  const out = new BufferGeometry();
  for (const [name, attr] of Object.entries(geo.attributes)) {
    const a = attr as BufferAttribute;
    out.setAttribute(name, new BufferAttribute((a.array as Float32Array).slice(start * a.itemSize, (start + count) * a.itemSize), a.itemSize));
  }
  return out;
}

/**
 * Merges the model's still meshes by material. `keep` holds the parts that must stay separate
 * (they turn on and off or move); `own` holds materials whose glow is themed per material.
 */
export function mergeStatic(model: Object3D, keep: ReadonlySet<Object3D>, own: ReadonlySet<Material>) {
  model.updateMatrixWorld(true);
  const toModel = new Matrix4().copy(model.matrixWorld).invert();
  const buckets = new Map<string, { material: Material; parts: BufferGeometry[] }>();
  const merged: Mesh[] = [];
  const visit = (o: Object3D) => {
    if (keep.has(o)) return;
    const mesh = o as Mesh;
    if (mesh.isMesh && (mesh as Mesh & { isSkinnedMesh?: boolean }).isSkinnedMesh !== true) {
      const local = new Matrix4().multiplyMatrices(toModel, mesh.matrixWorld);
      const flat = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      flat.applyMatrix4(local);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const groups = Array.isArray(mesh.material) && flat.groups.length
        ? flat.groups
        : [{ start: 0, count: flat.attributes.position.count, materialIndex: 0 }];
      for (const grp of groups) {
        const mat = mats[grp.materialIndex ?? 0];
        if (!mat || mat.visible === false) continue;
        const part = slice(flat, grp.start, grp.count);
        const key = materialKey(mat, own);
        const b = buckets.get(key) ?? { material: mat, parts: [] };
        b.parts.push(part);
        buckets.set(key, b);
      }
      merged.push(mesh);
    }
    o.children.forEach(visit);
  };
  model.children.forEach(visit);
  if (merged.length < 2) return;
  for (const mesh of merged) mesh.parent?.remove(mesh);
  for (const { material, parts } of buckets.values()) {
    // Only attributes every part has (a vertex-colored dome has more than a box).
    const names = Object.keys(parts[0].attributes).filter((n) => parts.every((p) => p.attributes[n]));
    for (const p of parts) for (const n of Object.keys(p.attributes)) if (!names.includes(n)) p.deleteAttribute(n);
    const geo = mergeGeometries(parts, false);
    if (!geo) continue;
    geo.computeBoundingSphere();
    model.add(new Mesh(geo, material));
  }
}
