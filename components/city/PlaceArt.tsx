// Placeholder illustrations for places (C37) and their interiors (C38). Drawn from
// each place's palette so every location looks distinct; real art replaces these
// through the same components, keyed by place id and template.

import type { InteriorTemplate, Place } from "@/lib/city";

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

/** Full-screen interior backdrop (C38): club, café and counter-shop templates. */
export function InteriorBackdrop({ template, place, daytime }: { template: Exclude<InteriorTemplate, "apartment">; place: Place; daytime: boolean }) {
  const [a, b, c] = place.palette;
  const id = `ib-${place.id}`;
  const light = template === "club" ? false : daytime;
  return (
    <svg className="layer" viewBox="0 0 390 844" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={template === "club" ? "#120E1A" : light ? b : c} />
          <stop offset="1" stopColor={template === "club" ? c : light ? shade(b, -0.12) : shade(c, 0.1)} />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx=".5" cy=".2" r=".7">
          <stop offset="0" stopColor={a} stopOpacity={template === "club" ? 0.55 : 0.25} />
          <stop offset="1" stopColor={a} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="390" height="844" fill={`url(#${id}-wall)`} />
      <rect width="390" height="844" fill={`url(#${id}-glow)`} />

      {template === "club" && (
        <g>
          {[-1, 1].map((s) => (
            <polygon key={s} points={`195,90 ${195 + s * 60},90 ${195 + s * 260},640 ${195 + s * 120},640`} fill={s < 0 ? a : b} opacity=".18" />
          ))}
          <circle cx="195" cy="110" r="26" fill="#C9CED6" />
          {Array.from({ length: 24 }).map((_, i) => (
            <rect key={i} x={177 + (i % 6) * 6} y={92 + Math.floor(i / 6) * 9} width="5" height="7" fill="#fff" opacity={(i * 7) % 3 ? 0.35 : 0.9} />
          ))}
          <rect x="30" y="330" width="330" height="40" rx="8" fill="#1F1B26" />
          <text x="195" y="357" textAnchor="middle" fontSize="20" fontWeight="800" letterSpacing="3" fill={a} fontFamily="system-ui, sans-serif">{place.name.toUpperCase()}</text>
          <rect y="610" width="390" height="234" fill="#0E0B12" />
          {Array.from({ length: 6 }).map((_, r) =>
            Array.from({ length: 7 }).map((__, k) => (
              <rect key={`${r}-${k}`} x={k * 58 - 10 + (r % 2) * 29} y={620 + r * 38} width="54" height="34" rx="3"
                fill={(r + k) % 3 === 0 ? a : (r + k) % 3 === 1 ? b : "#1F1B26"} opacity=".35" />
            )),
          )}
        </g>
      )}

      {template === "cafe" && (
        <g>
          <rect x="30" y="140" width="330" height="190" rx="12" fill={light ? "#FFF6E0" : "#2A2530"} opacity=".85" />
          <text x="195" y="190" textAnchor="middle" fontSize="22" fontWeight="800" fill={c} fontFamily="system-ui, sans-serif">{place.name}</text>
          {["Oat latte ... $6", "Gossip shot ... $4", "Avocado toast ... $14"].map((t, i) => (
            <text key={t} x="70" y={232 + i * 30} fontSize="15" fill={light ? "#4F4A56" : "#FFF6E0"} fontFamily="system-ui, sans-serif">{t}</text>
          ))}
          {[60, 150, 240, 330].map((x) => (
            <g key={x}>
              <line x1={x} y1="0" x2={x} y2="80" stroke="#1F1B26" strokeWidth="2" />
              <circle cx={x} cy="92" r="14" fill={a} />
              <circle cx={x} cy="92" r="24" fill="#FFC21A" opacity=".18" />
            </g>
          ))}
          <rect y="560" width="390" height="70" fill={a} />
          <rect y="548" width="390" height="16" fill={shade(a, -0.25)} />
          <rect y="630" width="390" height="214" fill={shade(c, -0.1)} />
          {[40, 120, 300].map((x) => <rect key={x} x={x} y="520" width="34" height="30" rx="4" fill="#fff" opacity=".9" />)}
        </g>
      )}

      {template === "counter" && (
        <g>
          {Array.from({ length: 4 }).map((_, r) => (
            <g key={r}>
              <rect x="20" y={130 + r * 90} width="350" height="8" fill="#1F1B26" opacity=".6" />
              {Array.from({ length: 9 }).map((__, k) => (
                <rect key={k} x={28 + k * 38} y={92 + r * 90} width="30" height="38" rx="3"
                  fill={[a, b, "#D93A2F", "#6C8CFF", "#FFF6E0"][(r * 3 + k) % 5]} opacity=".9" />
              ))}
            </g>
          ))}
          <rect x="40" y="480" width="150" height="34" rx="6" fill="#14111A" />
          <text x="115" y="503" textAnchor="middle" fontSize="15" fontWeight="800" fill={b} fontFamily="system-ui, sans-serif">OPEN 24 HRS</text>
          <rect y="560" width="390" height="80" fill={a} />
          <rect y="548" width="390" height="16" fill={shade(a, -0.3)} />
          <rect y="640" width="390" height="204" fill={light ? "#CFC6B8" : "#2A2530"} />
          <g transform="translate(300 528)">
            <ellipse cx="0" cy="18" rx="22" ry="10" fill="#E8A44A" />
            <circle cx="16" cy="6" r="10" fill="#E8A44A" />
            <polygon points="10,-2 14,-12 18,-2" fill="#E8A44A" />
            <polygon points="18,-2 22,-12 24,0" fill="#E8A44A" />
          </g>
        </g>
      )}

      {!light && <rect width="390" height="844" fill="#0A0814" opacity={template === "club" ? 0 : 0.25} />}
    </svg>
  );
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f));
  return `#${ch.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
