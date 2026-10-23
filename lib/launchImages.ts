// iPhone launch images (owner, Oct 23): an installed app on iOS shows its own picture before the page arrives, black
// without one. Each iPhone screen needs its own size (CSS width × height at a pixel ratio); scripts/launch-images.mjs
// renders /preview/loading?still=1 at each into public/splash/, and app/layout.tsx lists them.
export const LAUNCH_SCREENS: readonly { w: number; h: number; dpr: number }[] = [
  { w: 440, h: 956, dpr: 3 }, // 16 Pro Max
  { w: 402, h: 874, dpr: 3 }, // 16 Pro
  { w: 430, h: 932, dpr: 3 }, // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  { w: 393, h: 852, dpr: 3 }, // 14 Pro, 15, 15 Pro, 16
  { w: 428, h: 926, dpr: 3 }, // 12/13 Pro Max, 14 Plus
  { w: 390, h: 844, dpr: 3 }, // 12, 13, 14
  { w: 375, h: 812, dpr: 3 }, // X, XS, 11 Pro, 12/13 mini
  { w: 414, h: 896, dpr: 3 }, // XS Max, 11 Pro Max
  { w: 414, h: 896, dpr: 2 }, // XR, 11
  { w: 375, h: 667, dpr: 2 }, // SE, 8
];

export const launchImageName = (s: { w: number; h: number; dpr: number }) => `launch-${s.w * s.dpr}x${s.h * s.dpr}.jpg`;

/** The metadata entries (Next's appleWebApp.startupImage). */
export const launchStartupImages = () => LAUNCH_SCREENS.map((s) => ({
  url: `/splash/${launchImageName(s)}`,
  media: `(device-width: ${s.w}px) and (device-height: ${s.h}px) and (-webkit-device-pixel-ratio: ${s.dpr}) and (orientation: portrait)`,
}));
