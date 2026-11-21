"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  DOOR_W, FINISHES, GARDEN, HOME_BUILD, OUTSIDE, PAINTS, PLAN_GRID, ROOM_NAMES, ZONE_NAMES, finishOf, gardenOf, newRoom, planCost, planFromTemplate,
  planProblems, rectOk, sidesOf, snapEdge, wallsOf, type FloorPlan, type HomePlan, type PlanPiece, type PlanRoom, type Side,
} from "@/lib/homeBuild";
import { FURNITURE, footprint, snap, type RoomItem, type RoomTemplate } from "@/lib/rooms";
import { formatCash } from "@/lib/economy";

// Build mode (migration 0169, owner Nov 20: "Move walls, add rooms, landscapes"; renters too; the contractor is instant).
// A plan of the home seen from above: drag a room to move it, its corners to resize it (the walls and doorway follow),
// name it, pick its floor and where its doorway is; paint the whole home; Outside, lay garden zones and place pieces.
// The price shows as you go (lib/homeBuild.ts planCost, the server's own sum) and is paid on Save.

const ZONE_FINISH: Record<string, string> = { Patio: "pavers", Path: "gravel", Deck: "deck", "Flower bed": "meadow", Pool: "pool", Sandbox: "sand" };
const SIDES: Side[] = ["n", "e", "s", "w"];
const SIDE_LABEL: Record<Side, string> = { n: "top", s: "bottom", e: "right", w: "left" };

type Drag =
  | { kind: "room"; id: string; x: number; z: number; orig: PlanRoom; corner?: [0 | 1, 0 | 1] }
  | { kind: "piece"; id: string; x: number; z: number; orig: PlanPiece };

export function BuildMode({ floors, startFloor, saved, homeKey, bank, furniture, onSave, onClose }: {
  /** The home's floors by key ("1", "2", "out"): lib/homeBuild.ts homeFloorsFor. */
  floors: Record<string, RoomTemplate>;
  startFloor: string;
  /** The plan as saved (null: the home as it came). */
  saved: HomePlan | null;
  homeKey: string;
  bank: number;
  /** What stands on each floor now (for reference on the plan), by key. */
  furniture: Record<string, RoomItem[]>;
  onSave: (plan: HomePlan) => Promise<boolean>;
  onClose: () => void;
}) {
  const [plan, setPlan] = useState<HomePlan>(() => saved ? structuredClone(saved) : { v: 1, home: homeKey, floors: {} });
  const [floorKey, setFloorKey] = useState(startFloor in floors ? startFloor : "1");
  const [sel, setSel] = useState<{ kind: "room" | "piece"; id: string } | null>(null);
  const [doorIdx, setDoorIdx] = useState(0);
  const [tab, setTab] = useState<"build" | "paint">("build");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);

  const t = floors[floorKey];
  const outside = !!t.outdoor;
  const fp: FloorPlan = plan.floors[floorKey] ?? planFromTemplate(t);
  const setFp = (next: FloorPlan) => setPlan((p) => ({ ...p, floors: { ...p.floors, [floorKey]: next } }));
  const walls = useMemo(() => (outside ? [] : wallsOf(fp.rooms, t.w, t.d)), [fp.rooms, t.w, t.d, outside]);
  const cost = useMemo(() => planCost(saved, plan, floors), [saved, plan, floors]);
  const problems = useMemo(() => planProblems(plan, homeKey, floors), [plan, homeKey, floors]);
  const room = sel?.kind === "room" ? fp.rooms.find((r) => r.id === sel.id) : undefined;
  const piece = sel?.kind === "piece" ? (fp.pieces ?? []).find((p) => p.id === sel.id) : undefined;
  const changed = JSON.stringify(plan) !== JSON.stringify(saved ?? { v: 1, home: homeKey, floors: {} });

  const updRoom = (id: string, f: (r: PlanRoom) => PlanRoom) => setFp({ ...fp, rooms: fp.rooms.map((r) => (r.id === id ? f(r) : r)) });
  const nextId = (prefix: string, ids: string[]) => { for (let i = 1; ; i++) if (!ids.includes(`${prefix}${i}`)) return `${prefix}${i}`; };

  // ---- Pointer: plan coordinates, dragging rooms, corners and pieces --------------------------------------------
  const toPlan = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, z: p.y };
  };
  const start = (e: ReactPointerEvent, d: Drag) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = d;
  };
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toPlan(e);
    const dx = p.x - d.x, dz = p.z - d.z;
    if (d.kind === "piece") {
      const f = footprint({ kind: d.orig.k, rot: d.orig.rot });
      const x = Math.min(t.w / 2 - f.w / 2, Math.max(-t.w / 2 + f.w / 2, snap(d.orig.x + dx)));
      const z = Math.min(t.d / 2 - f.d / 2, Math.max(-t.d / 2 + f.d / 2, snap(d.orig.z + dz)));
      setFp({ ...fp, pieces: (fp.pieces ?? []).map((q) => (q.id === d.id ? { ...q, x, z } : q)) });
      return;
    }
    const o = d.orig;
    let next: PlanRoom;
    if (d.corner) {
      const [cx, cz] = d.corner;
      next = {
        ...o,
        x0: cx === 0 ? snapEdge(o.x0 + dx, t.w / 2) : o.x0, x1: cx === 1 ? snapEdge(o.x1 + dx, t.w / 2) : o.x1,
        z0: cz === 0 ? snapEdge(o.z0 + dz, t.d / 2) : o.z0, z1: cz === 1 ? snapEdge(o.z1 + dz, t.d / 2) : o.z1,
      };
    } else {
      const w = o.x1 - o.x0, dd = o.z1 - o.z0;
      let x0 = snapEdge(o.x0 + dx, t.w / 2), z0 = snapEdge(o.z0 + dz, t.d / 2);
      if (x0 + w > t.w / 2) x0 = t.w / 2 - w;
      if (z0 + dd > t.d / 2) z0 = t.d / 2 - dd;
      next = { ...o, x0, z0, x1: x0 + w, z1: z0 + dd };
    }
    if (rectOk(t, fp, next)) updRoom(o.id, () => fixDoors(next));
  };
  const end = () => { drag.current = null; };

  /** Keeps a room's doorways on sides that still have an inner wall. */
  const fixDoors = (r: PlanRoom): PlanRoom => {
    if (outside) return r;
    const inner = sidesOf(r).filter((s) => Math.abs(s.at) < (s.axis === "x" ? t.d : t.w) / 2 - 1e-6).map((s) => s.side);
    const doors = r.doors.filter((d) => inner.includes(d.side));
    if (!doors.length && inner.length) doors.push({ side: inner[0], at: lenOf(r, inner[0]) / 2 });
    return { ...r, doors };
  };
  const lenOf = (r: PlanRoom, s: Side) => (s === "n" || s === "s" ? r.x1 - r.x0 : r.z1 - r.z0);

  // ---- Actions ------------------------------------------------------------------------------------------------
  const addRoom = () => {
    const name = outside ? "Patio" : ROOM_NAMES.find((n) => !fp.rooms.some((r) => r.name === n)) ?? "Bedroom";
    const r = newRoom(t, fp, nextId("r", fp.rooms.map((x) => x.id)), name, outside ? "pavers" : "oak");
    if (!r) return setNote(outside ? "No space left for a zone. Shrink one first." : "No space left for a room. Shrink one first.");
    setFp({ ...fp, rooms: [...fp.rooms, r] });
    setSel({ kind: "room", id: r.id });
    setDoorIdx(0);
    setNote(null);
  };
  const addPiece = (k: PlanPiece["k"]) => {
    const pieces = fp.pieces ?? [];
    if (pieces.length >= HOME_BUILD.maxPieces) return setNote(`That's ${HOME_BUILD.maxPieces} pieces. The garden is full.`);
    const id = nextId("p", pieces.map((p) => p.id));
    // The first spot near the middle where it doesn't sit on another piece.
    const f = FURNITURE[k];
    for (let ring = 0; ring < 30; ring++) for (let a = -ring; a <= ring; a++) for (let b = -ring; b <= ring; b++) {
      if (Math.max(Math.abs(a), Math.abs(b)) !== ring) continue;
      const x = a * 0.5, z = b * 0.5;
      if (Math.abs(x) + f.w / 2 > t.w / 2 || Math.abs(z) + f.d / 2 > t.d / 2) continue;
      const hit = pieces.some((q) => { const g = footprint({ kind: q.k, rot: q.rot }); return Math.abs(q.x - x) < (g.w + f.w) / 2 && Math.abs(q.z - z) < (g.d + f.d) / 2; });
      if (hit) continue;
      setFp({ ...fp, pieces: [...pieces, { id, k, x, z, rot: 0 }] });
      setSel({ kind: "piece", id });
      setNote(null);
      return;
    }
    setNote("No room left for that. Move something first.");
  };
  const remove = () => {
    if (room) setFp({ ...fp, rooms: fp.rooms.filter((r) => r.id !== room.id) });
    if (piece) setFp({ ...fp, pieces: (fp.pieces ?? []).filter((p) => p.id !== piece.id) });
    setSel(null);
  };
  const door = room?.doors[Math.min(doorIdx, room.doors.length - 1)];
  const innerSides = room && !outside ? SIDES.filter((s) => { const l = sidesOf(room).find((x) => x.side === s)!; return Math.abs(l.at) < (l.axis === "x" ? t.d : t.w) / 2 - 1e-6; }) : [];
  const setDoor = (f: (d: NonNullable<typeof door>) => NonNullable<typeof door>) => room && door && updRoom(room.id, (r) => ({ ...r, doors: r.doors.map((d) => (d === door ? f(d) : d)) }));

  const save = async () => {
    setSaving(true);
    const ok = await onSave(plan);
    setSaving(false);
    if (ok) onClose();
  };

  // ---- Drawing ------------------------------------------------------------------------------------------------
  const pad = 0.5;
  const fill = (r: PlanRoom) => finishOf(r.floor)?.floor ?? r.orig?.floor ?? t.floor;
  const floorLabel = (k: string) => (k === OUTSIDE ? "🌳 Outside" : Object.keys(floors).filter((x) => x !== OUTSIDE).length > 1 ? (k === "1" ? "Downstairs" : "Upstairs") : "🏠 Inside");
  const paint = PAINTS.find((p) => p.id === plan.paint);

  return (
    <div className="build-mode" role="dialog" aria-label="Build mode">
      <div className="build-top">
        <div className="row" style={{ gap: 6, flexWrap: "wrap", flex: 1 }}>
          {Object.keys(floors).map((k) => (
            <button key={k} className="chip" aria-pressed={k === floorKey} onClick={() => { setFloorKey(k); setSel(null); setNote(null); }}>{floorLabel(k)}</button>
          ))}
        </div>
        <button className="chip" onClick={onClose} aria-label="Close build mode">✕</button>
      </div>

      <div className="build-plan">
        <svg
          ref={svgRef}
          viewBox={`${-t.w / 2 - pad} ${-t.d / 2 - pad} ${t.w + pad * 2} ${t.d + pad * 2}`}
          onPointerMove={onMove} onPointerUp={end} onPointerCancel={end}
          onPointerDown={() => setSel(null)}
          style={{ touchAction: "none" }}
          aria-label={`Plan of ${outside ? "the garden" : "your home"}`}
        >
          {/* The floor as it comes: the grass Outside, the home's own floor inside. */}
          <rect x={-t.w / 2} y={-t.d / 2} width={t.w} height={t.d} fill={outside ? "#4C9A3F" : t.floorKind === "tile" ? "#FFFFFF" : t.floor} />
          {/* The grid, every half metre. */}
          {Array.from({ length: Math.floor(t.w / PLAN_GRID) + 1 }, (_, i) => -t.w / 2 + i * PLAN_GRID).map((x) => <line key={`gx${x}`} x1={x} y1={-t.d / 2} x2={x} y2={t.d / 2} className="build-grid" />)}
          {Array.from({ length: Math.floor(t.d / PLAN_GRID) + 1 }, (_, i) => -t.d / 2 + i * PLAN_GRID).map((z) => <line key={`gz${z}`} x1={-t.w / 2} y1={z} x2={t.w / 2} y2={z} className="build-grid" />)}
          {fp.rooms.map((r) => (
            <g key={r.id}>
              <rect x={r.x0} y={r.z0} width={r.x1 - r.x0} height={r.z1 - r.z0} fill={fill(r)} fillOpacity={0.92}
                className={`build-room${room?.id === r.id ? " is-sel" : ""}`}
                onPointerDown={(e) => { setSel({ kind: "room", id: r.id }); setDoorIdx(0); start(e, { kind: "room", id: r.id, ...toPlan(e), orig: r }); }} />
              <text x={(r.x0 + r.x1) / 2} y={(r.z0 + r.z1) / 2} className="build-label">{r.name}</text>
            </g>
          ))}
          {/* What stands here now, faintly, to build around. */}
          {(furniture[floorKey] ?? []).filter((i) => !i.id.startsWith("plan-")).map((i) => {
            const f = footprint(i);
            return <rect key={i.id} x={i.x - f.w / 2} y={i.z - f.d / 2} width={f.w} height={f.d} className="build-furniture" />;
          })}
          {walls.map(([x0, z0, x1, z1], i) => <line key={`w${i}`} x1={x0} y1={z0} x2={x1} y2={z1} className="build-wall" />)}
          <rect x={-t.w / 2} y={-t.d / 2} width={t.w} height={t.d} className={outside ? "build-fence" : "build-outer"} />
          {(fp.pieces ?? []).map((p) => {
            const f = footprint({ kind: p.k, rot: p.rot });
            const g = gardenOf(p.k);
            return (
              <g key={p.id} onPointerDown={(e) => { setSel({ kind: "piece", id: p.id }); start(e, { kind: "piece", id: p.id, ...toPlan(e), orig: p }); }}>
                <rect x={p.x - f.w / 2} y={p.z - f.d / 2} width={f.w} height={f.d} className={`build-piece${piece?.id === p.id ? " is-sel" : ""}`} />
                <text x={p.x} y={p.z} className="build-emoji" style={{ fontSize: Math.min(0.55, Math.max(0.3, Math.min(f.w, f.d) * 0.7)) }}>{g?.emoji}</text>
              </g>
            );
          })}
          {room && ([[0, 0], [1, 0], [0, 1], [1, 1]] as [0 | 1, 0 | 1][]).map(([cx, cz]) => (
            <circle key={`${cx}${cz}`} cx={cx ? room.x1 : room.x0} cy={cz ? room.z1 : room.z0} r={0.26} className="build-handle"
              onPointerDown={(e) => start(e, { kind: "room", id: room.id, ...toPlan(e), orig: room, corner: [cx, cz] })} />
          ))}
        </svg>
      </div>

      <div className="build-panel">
        {note && <p className="meta" style={{ color: "var(--text-1)" }}>{note}</p>}
        {room ? (
          <div className="stack-8">
            <div className="row" style={{ gap: 8 }}>
              <span className="body-strong" style={{ flex: 1 }}>{room.name} · {Math.round((room.x1 - room.x0) * 10) / 10} × {Math.round((room.z1 - room.z0) * 10) / 10} m</span>
              <button className="chip" onClick={remove}>🗑️ Remove</button>
            </div>
            <div className="build-scroll" role="group" aria-label="Name">
              {[...(outside ? ZONE_NAMES : ROOM_NAMES), ...((outside ? ZONE_NAMES : ROOM_NAMES).includes(room.name) ? [] : [room.name])].map((n) => (
                <button key={n} className="chip" aria-pressed={room.name === n} onClick={() => updRoom(room.id, (r) => ({ ...r, name: n, ...(outside && ZONE_FINISH[n] ? { floor: ZONE_FINISH[n] } : {}) }))}>{n}</button>
              ))}
            </div>
            <div className="build-scroll" role="group" aria-label="Floor">
              {FINISHES.filter((f) => !!f.outside === outside).map((f) => (
                <button key={f.id} className="build-swatch" aria-pressed={room.floor === f.id} onClick={() => updRoom(room.id, (r) => ({ ...r, floor: f.id }))} aria-label={f.name} title={f.name}>
                  <i style={{ background: f.floor }} /><span>{f.name}</span>
                </button>
              ))}
            </div>
            {!outside && (innerSides.length ? (
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }} role="group" aria-label="Doorway">
                <span className="meta">🚪 Doorway{room.doors.length > 1 ? "s" : ""}</span>
                {room.doors.length > 1 && room.doors.map((_, i) => <button key={i} className="chip" aria-pressed={i === Math.min(doorIdx, room.doors.length - 1)} onClick={() => setDoorIdx(i)}>{i + 1}</button>)}
                {door && <>
                  <button className="chip" onClick={() => setDoor((d) => ({ ...d, at: Math.max((d.w ?? DOOR_W) / 2, d.at - 0.5) }))} aria-label="Slide the doorway back">◀</button>
                  <button className="chip" onClick={() => setDoor((d) => ({ ...d, at: Math.min(lenOf(room, d.side) - (d.w ?? DOOR_W) / 2, d.at + 0.5) }))} aria-label="Slide the doorway on">▶</button>
                  {innerSides.length > 1 && <button className="chip" onClick={() => setDoor((d) => { const s = innerSides[(innerSides.indexOf(d.side) + 1) % innerSides.length]; return { side: s, at: lenOf(room, s) / 2 }; })}>On the {SIDE_LABEL[innerSides[(innerSides.indexOf(door.side) + 1) % innerSides.length]]}</button>}
                </>}
                {room.doors.length < 3 && <button className="chip" onClick={() => { const s = innerSides[0]; updRoom(room.id, (r) => ({ ...r, doors: [...r.doors, { side: s, at: lenOf(r, s) / 2 }] })); setDoorIdx(room.doors.length); }}>＋</button>}
                {room.doors.length > 1 && <button className="chip" onClick={() => { updRoom(room.id, (r) => ({ ...r, doors: r.doors.filter((d) => d !== door) })); setDoorIdx(0); }}>－</button>}
              </div>
            ) : <span className="meta">No inner walls: this room fills the side of the home.</span>)}
            <span className="meta">Drag the room to move it, or a corner to resize it.</span>
          </div>
        ) : piece ? (
          <div className="row" style={{ gap: 8 }}>
            <span className="body-strong" style={{ flex: 1 }}>{gardenOf(piece.k)?.emoji} {gardenOf(piece.k)?.name}</span>
            <button className="chip" onClick={() => setFp({ ...fp, pieces: (fp.pieces ?? []).map((q) => (q.id === piece.id ? { ...q, rot: (q.rot + 1) % 4 } : q)) })}>↻ Rotate</button>
            <button className="chip" onClick={remove}>🗑️ Remove</button>
          </div>
        ) : (
          <div className="stack-8">
            {!outside && (
              <div className="row" style={{ gap: 6 }} role="tablist">
                <button className="chip" aria-pressed={tab === "build"} onClick={() => setTab("build")}>🧱 Rooms</button>
                <button className="chip" aria-pressed={tab === "paint"} onClick={() => setTab("paint")}>🎨 Paint</button>
              </div>
            )}
            {outside ? (
              <>
                <div className="row" style={{ gap: 8 }}>
                  <span className="meta" style={{ flex: 1 }}>Lay a patio, a path or a pool, then plant things. Drag to move.</span>
                  <button className="chip" onClick={addRoom}>＋ Zone</button>
                </div>
                <div className="build-scroll" role="group" aria-label="Garden pieces">
                  {GARDEN.map((g) => (
                    <button key={g.k} className="build-pick" onClick={() => addPiece(g.k)}>
                      <span className="build-pick-emoji" aria-hidden="true">{g.emoji}</span><span>{g.name}</span><span className="meta">{formatCash(g.price)}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : tab === "build" ? (
              <div className="row" style={{ gap: 8 }}>
                <span className="meta" style={{ flex: 1 }}>Tap a room to change it. Walls and doorways follow the rooms.</span>
                <button className="chip" onClick={addRoom}>＋ Room</button>
              </div>
            ) : (
              <div className="build-scroll" role="group" aria-label="Wall paint">
                <button className="build-swatch" aria-pressed={!plan.paint} onClick={() => setPlan((p) => { const { paint: _drop, ...rest } = p; void _drop; return rest; })}>
                  <i style={{ background: floors["1"].wall }} /><span>As it came</span>
                </button>
                {PAINTS.map((p) => (
                  <button key={p.id} className="build-swatch" aria-pressed={plan.paint === p.id} onClick={() => setPlan((x) => ({ ...x, paint: p.id }))}>
                    <i style={{ background: p.wall, boxShadow: `inset 0 -8px 0 ${p.accent}` }} /><span>{p.name}</span>
                  </button>
                ))}
              </div>
            )}
            {!outside && tab === "paint" && <span className="meta">The whole home, {formatCash(HOME_BUILD.paint)}{paint ? `: ${paint.name}` : ""}.</span>}
          </div>
        )}

        <div className="build-foot">
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{cost.total ? formatCash(cost.total) : "Free"}</b>
            <span className="meta"> · {cost.lines.length ? cost.lines.map((l) => l.label).join(", ") : changed ? "nothing to pay" : "no changes yet"}</span>
          </span>
          <button className="chip" onClick={onClose}>Cancel</button>
          <button className="chip" aria-pressed="true" disabled={saving || !changed || problems.length > 0 || cost.total > bank} onClick={() => void save()}>
            {saving ? "…" : cost.total > bank ? "Can't afford it" : "Build it"}
          </button>
        </div>
      </div>
    </div>
  );
}
