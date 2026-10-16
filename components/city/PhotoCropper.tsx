"use client";

import { useEffect, useRef, useState } from "react";
import { TV, centerCrop, clampCrop, coverScale, zoomCrop, type Crop } from "@/lib/cloutTv";
import { cropToFrame } from "@/lib/tvUpload";

// v0.14 Clout TV (owner, Oct 16): "image dimensions must be specified with a widget to crop the image
// to the frame of the billboard". The photo sits behind the billboard's 4:5 frame; drag to move it,
// pinch or use the slider to zoom. It always covers the frame, and comes out at exactly 1080 × 1350.

export function PhotoCropper({ img, onDone, onCancel }: { img: ImageBitmap; onDone: (photo: Blob, preview: string) => void; onCancel: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [fw, setFw] = useState(0);
  const fh = (fw * TV.frame.h) / TV.frame.w;
  const [crop, setCrop] = useState<Crop | null>(null);
  const [busy, setBusy] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; scale: number } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setFw(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { if (fw) setCrop((c) => (c ? clampCrop(c, img.width, img.height, fw, fh) : centerCrop(img.width, img.height, fw, fh))); }, [fw, fh, img]);

  const url = useRef<string>("");
  useEffect(() => {
    // The photo, drawn once to a canvas URL for the <img> behind the frame.
    const c = document.createElement("canvas");
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    url.current = c.toDataURL("image/jpeg", 0.8);
    setCrop((x) => (x ? { ...x } : x));
  }, [img]);

  const min = fw ? coverScale(img.width, img.height, fw, fh) : 1;
  const set = (c: Crop) => setCrop(clampCrop(c, img.width, img.height, fw, fh));
  const local = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div className="stack-12 crop">
      <div style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "center" }}>
        <span className="title">Fit it to the billboard</span>
        <span className="meta">What you see is what the Big Screen shows.</span>
      </div>
      <div
        ref={box}
        className="crop-frame"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          pointers.current.set(e.pointerId, local(e));
          if (pointers.current.size === 2 && crop) {
            const [a, b] = [...pointers.current.values()];
            pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: crop.scale };
          }
        }}
        onPointerMove={(e) => {
          const prev = pointers.current.get(e.pointerId);
          if (!prev || !crop) return;
          const p = local(e);
          pointers.current.set(e.pointerId, p);
          if (pointers.current.size === 2 && pinch.current) {
            const [a, b] = [...pointers.current.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            set(zoomCrop(crop, pinch.current.scale * (d / pinch.current.d), (a.x + b.x) / 2, (a.y + b.y) / 2));
          } else if (pointers.current.size === 1) {
            set({ ...crop, x: crop.x + p.x - prev.x, y: crop.y + p.y - prev.y });
          }
        }}
        onPointerUp={(e) => { pointers.current.delete(e.pointerId); pinch.current = null; }}
        onPointerCancel={(e) => { pointers.current.delete(e.pointerId); pinch.current = null; }}
        onWheel={(e) => { if (crop) set(zoomCrop(crop, crop.scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08), fw / 2, fh / 2)); }}
      >
        {crop && url.current && (
          <img src={url.current} alt="" draggable={false} className="crop-img"
            style={{ width: img.width * crop.scale, height: img.height * crop.scale, transform: `translate(${crop.x}px, ${crop.y}px)` }} />
        )}
        <span className="crop-grid" aria-hidden="true" />
        <span className="crop-tag" aria-hidden="true">Billboard · 4:5</span>
      </div>
      <label className="crop-zoom">
        <span aria-hidden="true">−</span>
        <input type="range" min={1} max={TV.maxZoom} step={0.01} value={crop ? crop.scale / min : 1} aria-label="Zoom"
          onChange={(e) => crop && set(zoomCrop(crop, min * Number(e.target.value), fw / 2, fh / 2))} />
        <span aria-hidden="true">+</span>
      </label>
      <p className="meta" style={{ margin: 0, textAlign: "center" }}>Drag to move · pinch or slide to zoom · <span style={{ whiteSpace: "nowrap" }}>{TV.frame.w} × {TV.frame.h}</span></p>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn btn-secondary" style={{ width: "auto", flex: "none" }} onClick={onCancel}>Back</button>
        <button type="button" className="btn btn-night radio-submit" disabled={!crop || busy} onClick={async () => {
          if (!crop) return;
          setBusy(true);
          try {
            const blob = await cropToFrame(img, crop, fw);
            onDone(blob, URL.createObjectURL(blob));
          } finally {
            setBusy(false);
          }
        }}>{busy ? "Cropping…" : "Use this crop"}</button>
      </div>
    </div>
  );
}
