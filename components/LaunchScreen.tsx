"use client";

// The launch screen (owner, Oct 16: "take some time to load the game so the experience is smooth.
// Loading should be under two seconds"). It covers the cold start while the map, the landmarks and
// the avatar get ready, never longer than GAME_CONFIG.launch.maxMs, and never on a warm, fast open.


export function LaunchScreen({ progress, line, leaving }: { progress: number; line: string; leaving?: boolean }) {
  return (
    <div className={`launch${leaving ? " leaving" : ""}`} role="status" aria-live="polite" aria-label="Loading Clout City">
      <div className="launch-center">
        <h1 className="studio-mark launch-mark">Clout City</h1>
        <div className="launch-bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${Math.max(0.04, Math.min(1, progress))})` }} />
        </div>
        <p className="launch-line">{line}</p>
      </div>
      <svg className="launch-skyline" viewBox="0 0 390 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        {/* Queens at night: the Unisphere, the bridge, the towers, a water tower, lit windows. */}
        <g className="sky-far">
          <rect x="0" y="78" width="390" height="42" />
          <rect x="20" y="58" width="26" height="62" /><rect x="52" y="66" width="18" height="54" />
          <rect x="250" y="40" width="22" height="80" /><rect x="276" y="52" width="18" height="68" />
          <rect x="330" y="62" width="30" height="58" />
        </g>
        <g className="sky-near">
          <path d="M96 120 V86 h40 V120 Z" /><path d="M150 120 V70 h16 V58 h10 V70 h16 V120 Z" />
          <circle cx="222" cy="70" r="16" fill="none" strokeWidth="2.4" />
          <ellipse cx="222" cy="70" rx="7" ry="16" fill="none" strokeWidth="1.6" />
          <path d="M206 70 h32 M222 86 v34" fill="none" strokeWidth="2" />
          <path d="M296 120 V80 h26 V120 Z" /><path d="M303 80 v-8 h12 v8" /><path d="M300 72 l9 -6 l9 6 Z" />
        </g>
        <path className="sky-bridge" d="M0 92 L40 74 L80 92 L120 70 L160 92" fill="none" strokeWidth="2.2" />
        <g className="sky-windows">
          {[[26, 66], [36, 76], [56, 74], [256, 50], [262, 64], [280, 60], [336, 70], [348, 80], [102, 94], [124, 100], [156, 80], [182, 90], [302, 90], [314, 100]].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" />
          ))}
        </g>
      </svg>
    </div>
  );
}
