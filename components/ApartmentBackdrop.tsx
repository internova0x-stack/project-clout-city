// The illustrated apartment backdrop (interior template "apartment", C38).
// A placeholder drawing; real 2.5D art replaces it through this same slot.

export function ApartmentBackdrop({ daytime }: { daytime: boolean }) {
  return (
    <svg className="layer" viewBox="0 0 390 844" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="apt-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2B2236" />
          <stop offset="1" stopColor="#3A2C44" />
        </linearGradient>
        <linearGradient id="apt-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4A3426" />
          <stop offset="1" stopColor="#2E2018" />
        </linearGradient>
        <linearGradient id="apt-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={daytime ? "#7FB3E8" : "#1B1530"} />
          <stop offset="1" stopColor={daytime ? "#F6C9A0" : "#4A2350"} />
        </linearGradient>
        <radialGradient id="apt-lamp" cx="0.5" cy="0" r="0.8">
          <stop offset="0" stopColor="#FFC21A" stopOpacity=".35" />
          <stop offset="1" stopColor="#FFC21A" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* wall and floor */}
      <rect width="390" height="844" fill="url(#apt-wall)" />
      <rect y="600" width="390" height="244" fill="url(#apt-floor)" />
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={i} x1={i * 56 - 20} y1="600" x2={i * 80 - 120} y2="844" stroke="rgba(0,0,0,.18)" strokeWidth="2" />
      ))}
      <rect y="596" width="390" height="8" fill="#22192A" />

      {/* window with the skyline */}
      <g transform="translate(40 150)">
        <rect width="310" height="300" rx="10" fill="#1A1420" />
        <rect x="10" y="10" width="290" height="280" rx="4" fill="url(#apt-sky)" />
        {!daytime && <circle cx="240" cy="70" r="20" fill="#FFF6E0" opacity=".9" />}
        <g fill={daytime ? "#5A6B86" : "#120E1A"}>
          <rect x="20" y="170" width="34" height="120" />
          <rect x="58" y="130" width="28" height="160" />
          <rect x="90" y="190" width="40" height="100" />
          <rect x="134" y="110" width="22" height="180" />
          <polygon points="145,80 150,110 140,110" />
          <rect x="160" y="160" width="36" height="130" />
          <rect x="200" y="140" width="30" height="150" />
          <rect x="234" y="185" width="56" height="105" />
        </g>
        {!daytime && (
          <g fill="#FFC21A" opacity=".75">
            {[[28, 190], [40, 214], [64, 150], [72, 176], [98, 210], [112, 230], [140, 130], [140, 160], [170, 180], [182, 204], [206, 160], [216, 196], [244, 205], [262, 230], [274, 210]].map(([x, y], i) => (
              <rect key={i} x={x} y={y} width="5" height="7" />
            ))}
          </g>
        )}
        {/* bridge */}
        <path d="M10 250 Q 80 205 150 250 Q 220 205 300 250" stroke={daytime ? "#8A93A8" : "#FF2E88"} strokeWidth="2" fill="none" opacity=".7" />
        <rect x="10" y="250" width="290" height="4" fill={daytime ? "#8A93A8" : "#FF2E88"} opacity=".5" />
        <rect x="153" y="10" width="4" height="280" fill="#1A1420" />
        <rect x="10" y="148" width="290" height="4" fill="#1A1420" />
        <rect x="-8" y="296" width="326" height="12" rx="4" fill="#22192A" />
      </g>

      {/* string lights */}
      <path d="M0 110 Q 100 150 195 120 T 390 115" stroke="#3A2C44" strokeWidth="1.5" fill="none" />
      {[20, 60, 100, 140, 180, 220, 260, 300, 340, 375].map((x, i) => (
        <circle key={x} cx={x} cy={118 + Math.sin(i) * 10} r="4" fill={i % 2 ? "#FF2E88" : "#FFC21A"} opacity=".9" />
      ))}

      {/* poster */}
      <g transform="translate(300 480) rotate(4)">
        <rect width="62" height="84" rx="3" fill="#FF2E88" />
        <text x="31" y="38" textAnchor="middle" fontFamily="var(--font-display)" fontSize="14" fill="#14111A">MAIN</text>
        <text x="31" y="56" textAnchor="middle" fontFamily="var(--font-display)" fontSize="9" fill="#14111A">CHARACTER</text>
      </g>

      {/* lamp and plant */}
      <g transform="translate(26 470)">
        <rect x="20" y="40" width="4" height="100" fill="#14111A" />
        <path d="M2 40 L42 40 L32 10 L12 10 Z" fill="#FFC21A" />
        <ellipse cx="22" cy="140" rx="18" ry="4" fill="#14111A" />
      </g>
      <rect x="0" y="470" width="120" height="260" fill="url(#apt-lamp)" />
      <g transform="translate(316 560)">
        <path d="M10 40 Q 0 10 14 0 Q 18 20 18 40" fill="#2F7A55" />
        <path d="M22 40 Q 34 8 46 6 Q 36 26 30 40" fill="#40B589" />
        <rect x="6" y="38" width="36" height="34" rx="6" fill="#E8692E" />
      </g>

      {/* rug: the avatar's marked spot */}
      <ellipse cx="195" cy="720" rx="150" ry="36" fill="#6B2B55" opacity=".7" />
      <ellipse cx="195" cy="720" rx="130" ry="28" fill="none" stroke="#FFC21A" strokeOpacity=".4" strokeDasharray="6 6" />
    </svg>
  );
}
