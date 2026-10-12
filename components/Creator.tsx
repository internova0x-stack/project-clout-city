"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { CreateResult } from "@/app/create/actions";
import { SKIN_TONES, STARTING_STYLES, getStyle, type Look, type StyleId } from "@/lib/styles";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cleanName, nameError } from "@/lib/validation";
import { ShuffleIcon } from "./icons";

const Avatar3D = dynamic(() => import("./avatar/Avatar3D"), { ssr: false });

// The mini creator (Milestones v0.1): the Look step only. Name, one of the
// eight starting styles and a skin tone; every choice re-dresses the avatar
// instantly. Traits, the birth lottery and Home arrive in v0.2.
export function Creator({
  needsAgeConfirm,
  onSubmit,
}: {
  needsAgeConfirm: boolean;
  onSubmit: (input: { name: string; style: string; skin: string; ageConfirmed?: boolean }) => Promise<CreateResult>;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [look, setLook] = useState<Look>({ style: "bodega_drip", skin: SKIN_TONES[3] });
  const [adult, setAdult] = useState(!needsAgeConfirm);
  const [touched, setTouched] = useState(false);
  const [taken, setTaken] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const style = getStyle(look.style);
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

  const shuffle = () =>
    setLook({
      style: STARTING_STYLES[Math.floor(Math.random() * STARTING_STYLES.length)].id,
      skin: SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)],
    });

  const submit = () => {
    setTouched(true);
    setError(null);
    if (!canSubmit) return;
    startTransition(async () => {
      const result = await onSubmit({ name, style: look.style, skin: look.skin, ageConfirmed: adult });
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
      <section className="stage" style={{ flex: "1 1 46%", minHeight: 260 }}>
        <div className="row" style={{ position: "absolute", zIndex: 2, top: "calc(12px + var(--safe-top))", left: 16, right: 16 }}>
          <span style={{ width: 36 }} />
          <div className="spacer center">
            <h1 className="display-sm" style={{ margin: 0, color: "var(--text-on-dark)" }}>Look</h1>
            <p className="meta" style={{ margin: "2px 0 0", color: "rgba(255,246,224,.6)" }}>Drag to spin. Judge yourself.</p>
          </div>
          <button className="icon-round dark" onClick={shuffle} aria-label="Shuffle look">
            <ShuffleIcon size={18} />
          </button>
        </div>
        <Avatar3D look={look} framing="full" />
      </section>

      <section
        style={{
          flex: "1 1 54%", background: "var(--surface-sheet)", color: "var(--text-1)", borderRadius: "28px 28px 0 0",
          marginTop: -24, position: "relative", zIndex: 3, display: "flex", flexDirection: "column", minHeight: 0,
        }}
      >
        <div style={{ overflowY: "auto", padding: "24px 20px 0", flex: 1 }} className="stack-24">
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
            <p className="overline" style={{ margin: 0 }}>Starting style</p>
            <div className="chip-row" role="group" aria-label="Starting style" style={{ margin: "0 -20px", padding: "2px 20px" }}>
              {STARTING_STYLES.map((s) => (
                <button
                  key={s.id}
                  className="chip"
                  aria-pressed={look.style === s.id}
                  onClick={() => setLook((l) => ({ ...l, style: s.id as StyleId }))}
                >
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

          <div className="stack-8">
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Skin</p>
            <div className="swatches" role="group" aria-label="Skin tone">
              {SKIN_TONES.map((tone, i) => (
                <button
                  key={tone}
                  className="swatch"
                  style={{ background: tone }}
                  aria-pressed={look.skin === tone}
                  aria-label={`Skin tone ${i + 1}`}
                  onClick={() => setLook((l) => ({ ...l, skin: tone }))}
                />
              ))}
            </div>
          </div>

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
