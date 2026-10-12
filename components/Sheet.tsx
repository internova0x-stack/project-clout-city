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
  const drag = useRef<{ startY: number; dy: number } | null>(null);
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

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose, dismissible]);

  if (!rendered) return null;
  const closing = !open;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!dismissible) return;
    drag.current = { startY: e.clientY, dy: 0 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !ref.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.startY);
    ref.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onPointerUp = () => {
    if (!drag.current || !ref.current) return;
    const { dy } = drag.current;
    drag.current = null;
    ref.current.style.transform = "";
    if (dy > 80) onClose();
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
      >
        <div
          style={{ padding: "0 0 4px", touchAction: "none", cursor: dismissible ? "grab" : "default" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="sheet-handle" />
        </div>
        {dismissible && (
          <button className="icon-round sheet-close" onClick={onClose} aria-label="Close">
            <CloseIcon size={18} />
          </button>
        )}
        <div className="sheet-body">{open ? children : lastChildren.current}</div>
      </div>
    </>
  );
}
