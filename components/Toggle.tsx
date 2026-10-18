"use client";

/** An on/off switch (owner, Oct 18: Settings' on/off choices are toggles, not buttons). */
export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="toggle" disabled={disabled} onClick={onChange}>
      <span className="toggle-knob" aria-hidden="true" />
    </button>
  );
}
