/** Isometric block: top, left and right faces (Monument Valley style). */
function Block({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const dy = w / 2;
  return (
    <>
      <polygon points={`${x},${y} ${x + w},${y + dy} ${x},${y + 2 * dy} ${x - w},${y + dy}`} fill="#FBE3DA" />
      <polygon points={`${x - w},${y + dy} ${x},${y + 2 * dy} ${x},${y + 2 * dy + h} ${x - w},${y + dy + h}`} fill="#F2A99A" />
      <polygon points={`${x},${y + 2 * dy} ${x + w},${y + dy} ${x + w},${y + dy + h} ${x},${y + 2 * dy + h}`} fill="#D9584A" />
    </>
  );
}

/**
 * The player's virtual card: a quiet Monument Valley card at dusk (owner, Oct 13). Shown on the
 * birth lottery's reveal and, with the balance on it, at the top of the Bank (#28). Virtual cash only.
 */
export function CloutCard({ handle, balance }: { handle: string; balance?: string }) {
  return (
    <div className="cash-card" aria-hidden={balance ? undefined : true} role={balance ? "img" : undefined} aria-label={balance ? `Virtual card, balance ${balance}` : undefined}>
      <svg className="cash-card-scene" viewBox="0 0 320 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <circle cx="246" cy="62" r="26" fill="#FFF6EC" opacity=".9" />
        <Block x={222} y={112} w={46} h={60} />
        <Block x={268} y={120} w={30} h={34} />
        <Block x={190} y={150} w={26} h={22} />
        <rect x="219" y="96" width="6" height="18" fill="#F2A99A" />
        <polygon points="216,96 222,90 228,96" fill="#D9584A" />
      </svg>
      <span className="cash-card-mark">CLOUT CITY</span>
      {balance && <span className="cash-card-balance">{balance}</span>}
      <span className="cash-card-tag">C$ · VIRTUAL</span>
      <span className="cash-card-who">{handle ? `@${handle}` : "New arrival"}</span>
    </div>
  );
}
