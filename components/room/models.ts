// Modeled furniture (owner, Nov 20: "great furniture", the competitor's references): GLB files in public/models/, made with
// Higgsfield's 3D generator or taken from free CC0 packs (Kenney), compressed by scripts/models.mjs. A room item names one
// with `model`; buildFurniture draws its box-built piece at once and swaps the model in when it has loaded, scaled to the
// piece's footprint and standing on the floor. Low graphics keeps the box-built pieces.
import { Box3, Group, Mesh, Vector3, type Material, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface ModelInfo {
  /** The file in public/models/. */
  file: string;
  /** Quarter turns that make the model face +z like every piece (generated models face whichever way they came out). */
  turn?: number;
  /** Fit the footprint (default) or keep the model's own proportions to this height in meters. */
  height?: number;
  /** Its real width in meters (along x once turned); else it fits the piece's footprint. */
  width?: number;
  /** Hangs from the ceiling: its top at this height instead of standing on the floor (a chandelier). */
  hangTop?: number;
  /** Credit for the file's maker (CC0 needs none; kept for our records). */
  source: string;
}

/** Every model, by id. */
export const MODELS: Record<string, ModelInfo> = {
  podium: { file: "podium.glb", height: 1.25, source: "Higgsfield (Tripo), generated Nov 20" },
  chesterfield: { file: "chesterfield.glb", width: 2.2, turn: 2, source: "Higgsfield (Tripo), generated Nov 20" },
  chandelier: { file: "chandelier.glb", width: 1.1, hangTop: 2.65, source: "Higgsfield (Tripo), generated Nov 20" },
  execDesk: { file: "exec-desk.glb", width: 1.9, source: "Higgsfield (Tripo), generated Nov 20" },
  receptionDesk: { file: "reception-desk.glb", width: 2.6, turn: 2, source: "Higgsfield (Tripo), generated Nov 20" },
  sectional: { file: "sectional.glb", width: 3.2, source: "Higgsfield (Tripo), generated Nov 20" },
  // Kenney's Furniture Kit (CC0, kenney.nl; public/models/kenney/LICENSE.txt): everyday pieces.
  "k:chairDesk": { file: "kenney/chairDesk.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:chairModernCushion": { file: "kenney/chairModernCushion.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:chairRounded": { file: "kenney/chairRounded.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:desk": { file: "kenney/desk.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:computerScreen": { file: "kenney/computerScreen.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:laptop": { file: "kenney/laptop.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:bookcaseClosedWide": { file: "kenney/bookcaseClosedWide.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:bookcaseOpen": { file: "kenney/bookcaseOpen.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:loungeSofa": { file: "kenney/loungeSofa.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:loungeSofaLong": { file: "kenney/loungeSofaLong.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:loungeDesignSofa": { file: "kenney/loungeDesignSofa.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:loungeChair": { file: "kenney/loungeChair.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:loungeDesignChair": { file: "kenney/loungeDesignChair.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:tableCoffeeGlass": { file: "kenney/tableCoffeeGlass.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:tableCoffee": { file: "kenney/tableCoffee.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:tableRound": { file: "kenney/tableRound.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:table": { file: "kenney/table.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:pottedPlant": { file: "kenney/pottedPlant.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:plantSmall1": { file: "kenney/plantSmall1.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:plantSmall2": { file: "kenney/plantSmall2.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:lampRoundFloor": { file: "kenney/lampRoundFloor.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:lampSquareFloor": { file: "kenney/lampSquareFloor.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:kitchenFridgeLarge": { file: "kenney/kitchenFridgeLarge.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:kitchenCoffeeMachine": { file: "kenney/kitchenCoffeeMachine.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:kitchenBar": { file: "kenney/kitchenBar.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:kitchenCabinet": { file: "kenney/kitchenCabinet.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:kitchenStove": { file: "kenney/kitchenStove.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:stoolBar": { file: "kenney/stoolBar.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:rugRectangle": { file: "kenney/rugRectangle.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:rugRound": { file: "kenney/rugRound.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:televisionModern": { file: "kenney/televisionModern.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:speaker": { file: "kenney/speaker.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:sideTable": { file: "kenney/sideTable.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
  "k:coatRack": { file: "kenney/coatRack.glb", source: "Kenney Furniture Kit 2.0 (CC0)" },
};

const cache = new Map<string, Promise<Object3D | null>>();
let loader: GLTFLoader | null = null;

/** The model's scene, loaded once and shared (each use gets a clone). */
function loadModel(file: string): Promise<Object3D | null> {
  let p = cache.get(file);
  if (!p) {
    loader ??= new GLTFLoader();
    p = loader.loadAsync(`/models/${file}`).then((g) => g.scene as Object3D).catch(() => null);
    cache.set(file, p);
  }
  return p;
}

/**
 * Loads `id`, scales it to fit a w × d footprint (or `height`), turns it to face +z, stands it on y = 0 and centers it.
 * Resolves null when the model is unknown or fails to load (the caller keeps its box-built piece).
 */
export async function placedModel(id: string, w: number, d: number): Promise<Group | null> {
  const info = MODELS[id];
  if (!info) return null;
  const src = await loadModel(info.file);
  if (!src) return null;
  const inner = src.clone(true);
  inner.rotation.y = ((info.turn ?? 0) * Math.PI) / 2;
  const holder = new Group();
  holder.add(inner);
  holder.updateMatrixWorld(true);
  let box = new Box3().setFromObject(holder);
  let size = box.getSize(new Vector3());
  // A piece with a real width is long along x (a sofa, a desk): a model that came out long along z is turned a quarter.
  if (info.width && size.z > size.x * 1.15) {
    inner.rotation.y += Math.PI / 2;
    holder.updateMatrixWorld(true);
    box = new Box3().setFromObject(holder);
    size = box.getSize(new Vector3());
  }
  const k = info.width ? info.width / Math.max(1e-6, size.x) : info.height ? info.height / Math.max(1e-6, size.y) : Math.min(w / Math.max(1e-6, size.x), d / Math.max(1e-6, size.z));
  inner.scale.multiplyScalar(k);
  holder.updateMatrixWorld(true);
  const b2 = new Box3().setFromObject(holder);
  const c = b2.getCenter(new Vector3());
  inner.position.x -= c.x; inner.position.z -= c.z;
  inner.position.y -= info.hangTop !== undefined ? b2.max.y - info.hangTop : b2.min.y;
  holder.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; (m.material as Material).needsUpdate = true; }
  });
  return holder;
}
