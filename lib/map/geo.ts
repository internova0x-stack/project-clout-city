// One coordinate system for the whole game (Clarifications section 4): real
// latitude and longitude. The map renderer projects them; game logic never does.

export type LatLng = readonly [lat: number, lng: number];
