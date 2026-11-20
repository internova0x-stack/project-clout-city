// Modeled furniture (owner, Nov 20: "great furniture", the competitor's references): GLB files in public/models/, made with
// Higgsfield's 3D generator or taken from free CC0 packs (Kenney), compressed by scripts/models.mjs. A room item names one
// with `model`; buildFurniture draws its box-built piece at once and swaps the model in when it has loaded, scaled to the
// piece's footprint and standing on the floor. Low graphics keeps the box-built pieces.
import { Box3, Group, Mesh, Vector3, type Material, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

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
  /** Came out standing on its edge (a rug): laid flat, its thin side down. */
  layFlat?: boolean;
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
  // The second batch (Nov 20): clubs, the station, Clout TV, campus and luxury pieces for any room.
  booth: { file: "booth.glb", width: 2.4, source: "Higgsfield (Tripo), generated Nov 20" },
  bar: { file: "bar.glb", width: 3.2, source: "Higgsfield (Tripo), generated Nov 20" },
  djBooth: { file: "dj-booth.glb", width: 2.2, source: "Higgsfield (Tripo), generated Nov 20" },
  barStool: { file: "bar-stool.glb", height: 1.0, source: "Higgsfield (Tripo), generated Nov 20" },
  turnstile: { file: "turnstile.glb", height: 1.05, source: "Higgsfield (Tripo), generated Nov 20" },
  stationBench: { file: "station-bench.glb", width: 2.0, source: "Higgsfield (Tripo), generated Nov 20" },
  newsDesk: { file: "news-desk.glb", width: 2.6, source: "Higgsfield (Tripo), generated Nov 20" },
  tvCamera: { file: "tv-camera.glb", height: 1.7, source: "Higgsfield (Tripo), generated Nov 20" },
  bookshelf: { file: "bookshelf.glb", height: 2.2, source: "Higgsfield (Tripo), generated Nov 20" },
  readingTable: { file: "reading-table.glb", width: 1.4, source: "Higgsfield (Tripo), generated Nov 20" },
  lectureDesks: { file: "lecture-desks.glb", width: 1.7, source: "Higgsfield (Tripo), generated Nov 20" },
  diningSet: { file: "dining-set.glb", width: 1.8, source: "Higgsfield (Tripo), generated Nov 20" },
  velvetChair: { file: "velvet-chair.glb", width: 0.9, source: "Higgsfield (Tripo), generated Nov 20" },
  figTree: { file: "fig-tree.glb", height: 1.9, source: "Higgsfield (Tripo), generated Nov 20" },
  arcLamp: { file: "arc-lamp.glb", height: 2.0, source: "Higgsfield (Tripo), generated Nov 20" },
  marbleTable: { file: "marble-table.glb", width: 1.2, source: "Higgsfield (Tripo), generated Nov 20" },
  grandPiano: { file: "grand-piano.glb", width: 1.6, source: "Higgsfield (Tripo), generated Nov 20" },
  tvWall: { file: "tv-wall.glb", width: 2.6, source: "Higgsfield (Tripo), generated Nov 20" },
  poolTable: { file: "pool-table.glb", width: 2.5, source: "Higgsfield (Tripo), generated Nov 20" },
  bookcase: { file: "bookcase.glb", width: 1.8, turn: 2, source: "Higgsfield (Tripo), generated Nov 20" },
  rug: { file: "rug.glb", width: 3.0, layFlat: true, source: "Higgsfield (Tripo), generated Nov 20" },
  bed: { file: "bed.glb", width: 1.7, source: "Higgsfield (Tripo), generated Nov 20" },
  sofa: { file: "sofa.glb", width: 2.2, source: "Higgsfield (Tripo), generated Nov 20" },
  monstera: { file: "monstera.glb", height: 1.4, source: "Higgsfield (Tripo), generated Nov 20" },
  // Signature pieces, one per special place (owner, Nov 20: "a special furniture piece for each of the 18 locations").
  velvetBanquette: { file: "velvet-banquette.glb", width: 2.3, source: "Higgsfield (Tripo), generated Nov 20" }, // Velvet Static
  kilnBar: { file: "kiln-bar.glb", width: 2.4, source: "Higgsfield (Tripo), generated Nov 20" }, // The Kiln
  jukebox: { file: "jukebox.glb", height: 1.6, source: "Higgsfield (Tripo), generated Nov 20" }, // The Sticky Floor
  discoFloor: { file: "disco-floor.glb", width: 3.0, source: "Higgsfield (Tripo), generated Nov 20" }, // Discount Disco
  uvPod: { file: "uv-pod.glb", height: 1.6, source: "Higgsfield (Tripo), generated Nov 20" }, // Ultraviolet Society
  firePit: { file: "fire-pit.glb", width: 3.0, source: "Higgsfield (Tripo), generated Nov 20" }, // Altitude 718 Rooftop
  cabana: { file: "cabana.glb", width: 2.4, source: "Higgsfield (Tripo), generated Nov 20" }, // Ditmars Heights Rooftop
  waterTower: { file: "water-tower.glb", height: 4.2, source: "Higgsfield (Tripo), generated Nov 20" }, // Up on Wythe
  subwayEntrance: { file: "subway-entrance.glb", width: 3.0, source: "Higgsfield (Tripo), generated Nov 20" }, // Astoria Blvd station
  talkShow: { file: "talk-show.glb", width: 4.0, turn: 2, source: "Higgsfield (Tripo), generated Nov 20" }, // Clout TV Tower
  founderStatue: { file: "founder-statue.glb", height: 2.8, source: "Higgsfield (Tripo), generated Nov 20" }, // St. Johnsons University
  oakLectern: { file: "oak-lectern.glb", height: 1.3, source: "Higgsfield (Tripo), generated Nov 20" }, // Queensborough University
  trophyCase: { file: "trophy-case.glb", width: 1.8, turn: 2, source: "Higgsfield (Tripo), generated Nov 20" }, // Grand Street Community College
  precinctDesk: { file: "precinct-desk.glb", width: 2.6, source: "Higgsfield (Tripo), generated Nov 20" }, // The 114½ Precinct
  fireEngine: { file: "fire-engine.glb", width: 7.0, source: "Higgsfield (Tripo), generated Nov 20" }, // Engine 7 Firehouse
  hospitalBed: { file: "hospital-bed.glb", width: 2.4, source: "Higgsfield (Tripo), generated Nov 20" }, // St. Copay's General Hospital
  parkFountain: { file: "park-fountain.glb", width: 3.2, source: "Higgsfield (Tripo), generated Nov 20" }, // Astoria Park
  parkCart: { file: "park-cart.glb", height: 2.4, source: "Higgsfield (Tripo), generated Nov 20" }, // Flushing Meadows Corona Park
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
    loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
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
  if (info.layFlat) inner.rotation.z = Math.PI / 2;
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
