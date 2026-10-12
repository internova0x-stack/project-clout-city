// Placeholder illustrations for places (C37). Drawn from
// each place's palette so every location looks distinct; real art replaces these
// through the same component, keyed by place id.

import type { Place } from "@/lib/city";

/** 16:9 exterior for the location card. */
export function PlaceArt({ place, daytime }: { place: Place; daytime: boolean }) {
  const [a, b, c] = place.palette;
  const id = `pa-${place.id}`;
  const sky = daytime ? ["#8EC5F0", "#F7D9B5"] : ["#1B1530", "#4A2350"];
  const park = place.category === "parks";
  return (
    <svg viewBox="0 0 320 180" className="place-art" role="img" aria-label={`${place.name} illustration`}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky[0]} />
          <stop offset="1" stopColor={sky[1]} />
        </linearGradient>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={c} />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#${id}-sky)`} />
      {!daytime && <circle cx="270" cy="32" r="12" fill="#FFF6E0" opacity=".9" />}
      {/* far skyline */}
      <g fill={daytime ? "#6F7F99" : "#120E1A"} opacity={daytime ? 0.55 : 0.9}>
        {[0, 26, 48, 80, 104, 140, 170, 200, 236, 262, 290].map((x, i) => (
          <rect key={x} x={x} y={70 - ((i * 37) % 40)} width={22 + (i % 3) * 6} height={120} />
        ))}
      </g>
      {park ? (
        <g>
          <rect y="120" width="320" height="60" fill={a} />
          <ellipse cx="160" cy="132" rx="70" ry="10" fill={b} opacity=".9" />
          <circle cx="160" cy="92" r="30" fill="none" stroke="#C9CED6" strokeWidth="4" />
          <ellipse cx="160" cy="92" rx="30" ry="10" fill="none" stroke="#C9CED6" strokeWidth="3" />
          <line x1="160" y1="122" x2="160" y2="132" stroke="#C9CED6" strokeWidth="4" />
          {[30, 70, 240, 285].map((x) => (
            <g key={x}>
              <rect x={x - 3} y="112" width="6" height="22" fill="#5A3E2B" />
              <circle cx={x} cy="104" r="18" fill={c} />
            </g>
          ))}
        </g>
      ) : (
        <g>
          <rect y="150" width="320" height="30" fill={daytime ? "#8D8A92" : "#221D2A"} />
          <rect x="60" y="38" width="200" height="118" rx="4" fill={`url(#${id}-face)`} />
          {Array.from({ length: 3 }).map((_, r) =>
            Array.from({ length: 5 }).map((__, k) => (
              <rect key={`${r}-${k}`} x={74 + k * 38} y={48 + r * 22} width="24" height="14" rx="2"
                fill={daytime ? "rgba(255,255,255,.55)" : (r + k) % 3 ? "rgba(255,214,120,.85)" : "rgba(255,255,255,.12)"} />
            )),
          )}
          <rect x="120" y="116" width="80" height="40" rx="3" fill={c} />
          <rect x="128" y="122" width="64" height="34" fill={daytime ? "rgba(255,255,255,.35)" : b} opacity=".85" />
          <rect x="84" y="108" width="152" height="12" rx="6" fill={b} />
        </g>
      )}
      <g transform="translate(160 26)">
        <rect x="-58" y="-16" width="116" height="30" rx="15" fill="rgba(20,17,26,.78)" />
        <text x="0" y="5" textAnchor="middle" fontSize="13" fontWeight="700" fill="#FFF6E0" fontFamily="system-ui, sans-serif">
          {place.emoji} {place.name.length > 16 ? place.name.split(" ").slice(0, 2).join(" ") : place.name}
        </text>
      </g>
    </svg>
  );
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f));
  return `#${ch.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
