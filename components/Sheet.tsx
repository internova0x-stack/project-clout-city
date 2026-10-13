"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CloseIcon } from "./icons";

// Bottom sheet over the world (C13). Drag the handle down, tap the scrim or
// press Escape to dismiss. Opens in 320 ms with a spring, closes in 240 ms
// ease-in (Design System Guide section 13).
export function Sheet({
  open,
  onClose,
  label,
  children,
  tall = false,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  tall?: boolean;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; dy: number; active: boolean; id: number } | null>(null);
  // Stay mounted while the closing animation plays.
  const [rendered, setRendered] = useState(open);
  const lastChildren = useRef<ReactNode>(children);
  if (open) lastChildren.current = children;
  if (open && !rendered) setRendered(true);
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setRendered(false), 240);
    return () => clearTimeout(t);
  }, [open]);

  // Parents often pass a fresh onClose on every render (the guest map re-renders every few
  // seconds), so it lives in a ref: focus moves only when the sheet opens or closes, never
  // mid-typing, or the phone keyboard would drop (bug #1).
  const closeRef = useRef({ onClose, dismissible });
  useEffect(() => {
    closeRef.current = { onClose, dismissible };
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeRef.current.dismissible) closeRef.current.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]);

  // Sit on top of the on-screen keyboard instead of being pushed around by it: the sheet's
  // bottom follows the visible viewport, which shrinks when the keyboard opens.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!open || !vv) return;
    const place = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      ref.current?.style.setProperty("--kb", `${Math.round(kb)}px`);
    };
    place();
    vv.addEventListener("resize", place);
    vv.addEventListener("scroll", place);
    return () => {
      vv.removeEventListener("resize", place);
      vv.removeEventListener("scroll", place);
    };
  }, [open]);

  if (!rendered) return null;
  const closing = !open;

  // Drag down to dismiss: from the handle, or from anywhere while the content is scrolled
  // to the top. Taps on buttons and fields never start a drag; the sheet only takes over
  // the pointer once it has really moved down, so every button inside still gets its tap.
  const onPointerDown = (e: React.PointerEvent) => {
    if (!dismissible || e.button > 0) return;
    if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable], .no-sheet-drag")) return;
    if ((bodyRef.current?.scrollTop ?? 0) > 0 && !(e.target as HTMLElement).closest(".sheet-grip")) return;
    drag.current = { startY: e.clientY, dy: 0, active: false, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !ref.current || e.pointerId !== d.id) return;
    d.dy = Math.max(0, e.clientY - d.startY);
    if (!d.active) {
      if (d.dy < 10) return;
      d.active = true;
      ref.current.setPointerCapture(e.pointerId);
    }
    ref.current.style.transform = `translateY(${d.dy}px)`;
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active || !ref.current) return;
    ref.current.style.transform = "";
    if (d.dy > 80) onClose();
  };

  return (
    <>
      <div className={`scrim${closing ? " closing" : ""}`} onClick={dismissible && !closing ? onClose : undefined} aria-hidden="true" />
      <div
        ref={ref}
        className={`sheet${tall ? " tall" : ""}${closing ? " closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="sheet-grip" style={{ cursor: dismissible ? "grab" : "default" }}>
          <div className="sheet-handle" />
        </div>
        {dismissible && (
          <button className="icon-round sheet-close" onClick={onClose} aria-label="Close">
            <CloseIcon size={18} />
          </button>
        )}
        <div ref={bodyRef} className="sheet-body">{open ? children : lastChildren.current}</div>
      </div>
    </>
  );
}
