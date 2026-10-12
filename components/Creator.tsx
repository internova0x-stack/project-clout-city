"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { CreateResult } from "@/app/create/actions";
import {
  BODIES, COVERINGS, DEFAULT_LOOK, EYE_COLORS, GLASSES, HAIRS, HAIR_COLORS, SKIN_TONES,
  lookChoices, randomLook, type Look, type LookChoices,
} from "@/lib/look";
import { STARTING_STYLES, STYLE_IDS, getStyle } from "@/lib/styles";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cleanName, nameError } from "@/lib/validation";
import { ChevronLeftIcon, ShuffleIcon } from "./icons";

const Avatar3D = dynamic(() => import("./avatar/Avatar3D"), { ssr: false });

const STEPS = ["Look", "Traits", "Birth lottery", "Home"] as const;

// Character creation, step 1 of 4: Look (Clarifications section 1; Design System
// Guide section 12). The avatar stays on stage while the sheet below changes;
// every choice re-dresses it instantly.
export function Creator({
  needsAgeConfirm,
  onSubmit,
}: {
  needsAgeConfirm: boolean;
  onSubmit: (input: { name: string; style: string; look: LookChoices; ageConfirmed?: boolean }) => Promise<CreateResult>;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [look, setLook] = useState<Look>(DEFAULT_LOOK);
  const [adult, setAdult] = useState(!needsAgeConfirm);
  const [touched, setTouched] = useState(false);
  const [taken, setTaken] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const step = 0;

  const style = getStyle(look.style);
  const set = <K extends keyof Look>(key: K, value: Look[K]) => setLook((l) => ({ ...l, [key]: value }));
  const localError = touched ? nameError(name) : null;
  const nameMessage = error?.field === "name" ? error.text : localError ?? (taken ? "That name's taken. Somebody got there first." : null);
  const canSubmit = !nameError(name) && !taken && adult && !pending;

  // Live availability check, debounced.
  useEffect(() => {
    const supabase = getBrowserSupabase();
    const clean = cleanName(name);
    setTaken(false);
    if (!supabase || nameError(clean)) return;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("is_name_available", { p_display_name: clean });
      if (cleanName(name) === clean) setTaken(data === false);
    }, 450);
    return () => clearTimeout(t);
  }, [name]);

  const submit = () => {
    setTouched(true);
    setError(null);
    if (!canSubmit) return;
    startTransition(async () => {
      const result = await onSubmit({ name, style: look.style, look: lookChoices(look), ageConfirmed: adult });
      if (result.ok) {
        router.replace("/home?welcome=1");
        router.refresh();
      } else {
        setError({ text: result.error, field: result.field });
      }
    });
  };

  return (
    <main style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "var(--night-900)" }}>
      <section className="stage" style={{ flex: "1 1 44%", minHeight: 260 }}>
        <div className="row" style={{ position: "absolute", zIndex: 2, top: "calc(12px + var(--safe-top))", left: 16, right: 16, alignItems: "flex-start" }}>
          <button className="icon-round dark" aria-label="Back" disabled={step === 0} style={{ opacity: step === 0 ? 0 : 1 }}>
            <ChevronLeftIcon size={18} />
          </button>
          <div className="spacer center">
            <h1 className="display-sm" style={{ margin: 0, color: "var(--text-on-dark)" }}>{STEPS[step]}</h1>
            <div className="step-progress" role="img" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
              {STEPS.map((s, i) => <span key={s} className={i <= step ? "on" : undefined} />)}
            </div>
          </div>
          <button className="icon-round dark" onClick={() => setLook(randomLook(Math.random, STYLE_IDS))} aria-label="Shuffle look">
            <ShuffleIcon size={18} />
          </button>
        </div>
        <Avatar3D look={look} framing="full" />
      </section>

      <section
        style={{
          flex: "1 1 56%", background: "var(--surface-sheet)", color: "var(--text-1)", borderRadius: "28px 28px 0 0",
          marginTop: -24, position: "relative", zIndex: 3, display: "flex", flexDirection: "column", minHeight: 0,
        }}
      >
        <div style={{ overflowY: "auto", padding: "24px 20px 8px", flex: 1 }} className="stack-24">
          <div className="stack-8">
            <label className="overline" htmlFor="name">Name</label>
            <div className={`field${nameMessage ? " error" : ""}`}>
              <input
                id="name"
                value={name}
                maxLength={24}
                autoComplete="nickname"
                autoCapitalize="words"
                placeholder="Main character"
                onChange={(e) => {
                  setName(e.target.value);
                  if (error?.field === "name") setError(null);
                }}
                onBlur={() => setTouched(true)}
              />
              <span className="hint">your name in the city</span>
            </div>
            {nameMessage && <p className="error-text" role="alert" style={{ margin: 0 }}>{nameMessage}</p>}
          </div>

          <div className="stack-8">
            <p className="overline" style={{ margin: 0 }}>Body</p>
            <div className="binary" role="group" aria-label="Body">
              {BODIES.map((o) => (
                <button key={o.id} aria-pressed={look.body === o.id} onClick={() => set("body", o.id)}>{o.label}</button>
              ))}
            </div>
          </div>

          <div className="stack-8">
            <p className="overline" style={{ margin: 0 }}>Starting style</p>
            <div className="chip-row" role="group" aria-label="Starting style" style={{ margin: "0 -20px", padding: "2px 20px" }}>
              {STARTING_STYLES.map((s) => (
                <button key={s.id} className="chip" aria-pressed={look.style === s.id} onClick={() => set("style", s.id)}>
                  <span aria-hidden="true">{s.emoji}</span> {s.label}
                </button>
              ))}
            </div>
            <div className="card stack-8" style={{ animation: "rise-in .2s ease-out" }} key={style.id}>
              <p className="subtext" style={{ margin: 0 }}><strong style={{ color: "var(--text-1)" }}>{style.label}.</strong> {style.blurb}</p>
              <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                {style.starterItems.map((i) => <span key={i} className="tag tag-neutral">{i}</span>)}
              </div>
              <p className="meta" style={{ margin: 0 }}>Starter items only. No stats, no bonuses, all vibes.</p>
            </div>
          </div>

          <OptionGroup label="Hair" options={HAIRS} value={look.hair} onPick={(v) => set("hair", v)} />
          <Swatches label="Skin" colors={SKIN_TONES} value={look.skin} onPick={(v) => set("skin", v)} />
          <Swatches label="Hair color" colors={HAIR_COLORS} value={look.hairColor} onPick={(v) => set("hairColor", v)} />
          <Swatches label="Eyes" colors={EYE_COLORS} value={look.eyes} onPick={(v) => set("eyes", v)} />
          <OptionGroup label="Glasses" options={GLASSES} value={look.glasses} onPick={(v) => set("glasses", v)} />
          <OptionGroup label="Covering" options={COVERINGS} value={look.covering} onPick={(v) => set("covering", v)} />
          <p className="meta" style={{ margin: 0 }}>Hair, glasses and coverings are free for everyone, forever. The Shop will never sell them.</p>

          {needsAgeConfirm && (
            <label className="check-row">
              <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
              <span>I&apos;m 18 or older.</span>
            </label>
          )}

          {error && error.field !== "name" && <p className="error-text" role="alert">{error.text}</p>}
        </div>

        <div style={{ padding: "16px 20px calc(16px + var(--safe-bottom))", background: "linear-gradient(180deg, rgba(251,248,242,0), var(--surface-sheet) 16px)" }}>
          <button className="btn btn-taxi" onClick={submit} disabled={!canSubmit && touched}>
            {pending ? "Claiming…" : "Claim my name ›"}
          </button>
        </div>
      </section>
    </main>
  );
}

function OptionGroup<T extends string>({
  label, options, value, onPick,
}: { label: string; options: { id: T; label: string }[]; value: T; onPick: (v: T) => void }) {
  return (
    <div className="stack-8">
      <p className="creator-label">{label}</p>
      <div className="option-chips" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} className="chip" aria-pressed={value === o.id} onClick={() => onPick(o.id)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

function Swatches({
  label, colors, value, onPick,
}: { label: string; colors: readonly string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="stack-8">
      <p className="creator-label">{label}</p>
      <div className="swatches" role="group" aria-label={label}>
        {colors.map((c, i) => (
          <button
            key={c}
            className="swatch"
            style={{ background: c }}
            aria-pressed={value === c}
            aria-label={`${label} ${i + 1}`}
            onClick={() => onPick(c)}
          />
        ))}
      </div>
    </div>
  );
}
