// The map's props and the small interface the rest of the game talks to. The compact map (CompactMap.tsx) is the only
// map since the classic street map was retired (owner, Oct 30).

import type { CoutureMap } from "@/lib/coutureMap";
import type { BoroughId } from "@/lib/map/boroughs";
import type { LatLng } from "@/lib/map/geo";
import type { PlacePin } from "@/lib/places";

/**
 * The small map interface the rest of the game talks to (Clarifications section 4):
 * show pins, move the camera, locate the player, set a borough's lock state.
 * Game data stays in lat/lng, so the renderer behind this can change freely.
 */
export interface MapApi {
  moveCamera(at: LatLng, zoom?: number): void;
  locatePlayer(): void;
  setBoroughLock(id: BoroughId, locked: boolean): void;
  /** v0.8 trips: frame both ends from helicopter height (never street level). */
  frameTrip(from: LatLng, to: LatLng): void;
  /** Screen position of a point on the map, for overlays such as the moving taxi. */
  project(at: LatLng): { x: number; y: number } | null;
}

export interface CityMapProps {
  pins: PlacePin[];
  player?: { at: LatLng; emoji: string } | null;
  initialCenter: LatLng;
  initialZoom?: number;
  daytime?: boolean;
  onPinTap?: (pin: PlacePin) => void;
  onLockedTap?: (boroughName: string, id: BoroughId) => void;
  /** Hide the map's own credits control when the screen shows them elsewhere. */
  attributionControl?: boolean;
  /** Camera tilt in degrees (0 = straight down). */
  initialPitch?: number;
  /** Moving cars on the streets when zoomed in (v0.3). */
  vehicles?: boolean;
  /** Owner, Oct 14: px kept clear on the right (the side column); a name pill there slides left so it isn't hidden. */
  rightInset?: number;
  /** Open framed on every pin (the guest screen), leaving room for the screen's top and bottom panels. */
  fitPins?: { top: number; bottom: number };
  /** v0.14 Clout TV: the photo on the Clout Tower's big screen (null: the station's ident). */
  bigScreen?: { url: string | null; handle: string; photo: string } | null;
  /** Tapping the Clout Tower's name opens today's photo. */
  onBigScreen?: () => void;
  /** Clout Couture on the map (migration 0104): yachts, jets, the week's plaza statue. */
  couture?: CoutureMap | null;
  /** Tapping a yacht's or the statue's name opens its owner's card. */
  onOpenPlayer?: (playerId: string) => void;
}
