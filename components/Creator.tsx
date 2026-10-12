"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import type { CreateResult } from "@/app/create/actions";
import { ECONOMY, TRAITS, TRAIT_COUNT, canAfford, formatCash, lotteryLine } from "@/lib/economy";
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
export type CreatorStep = 0 | 1 | 2 | 3;

type StepResult = { ok: true } | { ok: false; error: string };

export interface CreatorActions {
  createPlayer: (input: { name: string; style: string; look: LookChoices; ageConfirmed?: boolean }) => Promise<CreateResult>;
  saveTraits: (traits: string[]) => Promise<StepResult>;
  rollBirthLottery: () => Promise<{ ok: true; cash: number } | { ok: false; error: string }>;
  moveIn: (homeId: string) => Promise<StepResult>;
}

/**
 * Character creation in four steps: Look, Traits, Birth lottery, Home
 * (Clarifications section 1; Design System Guide section 12). The avatar stays
 * on stage while the sheet below changes; every step ends in one loud button.
 */
export function Creator({
  needsAgeConfirm,
  actions,
  initialStep = 0,
  initialLook,
  initialTraits,
  initialCash,
}: {
  needsAgeConfirm: boolean;
  actions: CreatorActions;
  initialStep?: CreatorStep;
  initialLook?: Look;
  initialTraits?: string[] | null;
  initialCash?: number | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<CreatorStep>(initialStep);
  const [furthest, setFurthest] = useState<CreatorStep>(initialStep);
  const [look, setLook] = useState<Look>(initialLook ?? DEFAULT_LOOK);
  const [traits, setTraits] = useState<string[]>(initialTraits ?? []);
  const [cash, setCash] = useState<number | null>(initialCash ?? null);
  const lookLocked = initialStep > 0 || furthest > 0;

  const advance = (to: CreatorStep) => {
    setStep(to);
    setFurthest((f) => (to > f ? to : f));
  };
  // Back goes to earlier steps that can still change (Traits); Look is claimed once saved.
  const canGoBack = step > 1 || (step === 1 && !lookLocked);

  return (
    <main style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "var(--night-900)" }}>
      <section className="stage" style={{ flex: step === 0 ? "1 1 44%" : "1 1 40%", minHeight: 240 }}>
        <div className="row" style={{ position: "absolute", zIndex: 2, top: "calc(12px + var(--safe-top))", left: 16, right: 16, alignItems: "flex-start" }}>
          <button
            className="icon-round dark"
            aria-label="Back"
            disabled={!canGoBack}
            style={{ opacity: canGoBack ? 1 : 0 }}
            onClick={() => canGoBack && setStep((s) => (s - 1) as CreatorStep)}
          >
            <ChevronLeftIcon size={18} />
          </button>
          <div className="spacer center">
            <h1 className="display-sm" style={{ margin: 0, color: "var(--text-on-dark)" }}>{STEPS[step]}</h1>
            <div className="step-progress" role="img" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
              {STEPS.map((s, i) => <span key={s} className={i <= step ? "on" : undefined} />)}
            </div>
          </div>
          {step === 0 ? (
            <button className="icon-round dark" onClick={() => setLook(randomLook(Math.random, STYLE_IDS))} aria-label="Shuffle look">
              <ShuffleIcon size={18} />
            </button>
          ) : (
            <span style={{ width: 36 }} />
          )}
        </div>
        <Avatar3D look={look} framing="full" />
      </section>

      <section className="creator-sheet">
        {step === 0 && (
          <LookStep
            look={look}
            setLook={setLook}
            needsAgeConfirm={needsAgeConfirm}
            locked={lookLocked}
            onSubmit={actions.createPlayer}
            onDone={() => advance(1)}
          />
        )}
        {step === 1 && <TraitsStep traits={traits} setTraits={setTraits} onSave={actions.saveTraits} onDone={() => advance(2)} />}
        {step === 2 && <LotteryStep cash={cash} onRoll={actions.rollBirthLottery} onRolled={setCash} onDone={() => advance(3)} />}
        {step === 3 && (
          <HomeStep
            cash={cash ?? 0}
            onMoveIn={actions.moveIn}
            onDone={() => {
              router.replace("/home?welcome=1");
              router.refresh();
            }}
          />
        )}
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Shared sheet layout: scrolling content above one sticky loud button.
// ---------------------------------------------------------------------------
function StepSheet({ children, cta }: { children: ReactNode; cta: ReactNode }) {
  return (
    <>
      <div style={{ overflowY: "auto", padding: "24px 20px 8px", flex: 1 }} className="stack-24">{children}</div>
      <div className="creator-cta">{cta}</div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Look
// ---------------------------------------------------------------------------
function LookStep({
  look, setLook, needsAgeConfirm, locked, onSubmit, onDone,
}: {
  look: Look;
  setLook: (fn: (l: Look) => Look) => void;
  needsAgeConfirm: boolean;
  locked: boolean;
  onSubmit: CreatorActions["createPlayer"];
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [adult, setAdult] = useState(!needsAgeConfirm);
  const [touched, setTouched] = useState(false);
  const [taken, setTaken] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const style = getStyle(look.style);
  const set = <K extends keyof Look>(key: K, value: Look[K]) => setLook((l) => ({ ...l, [key]: value }));
  const localError = touched ? nameError(name) : null;
  const nameMessage = error?.field === "name" ? error.text : localError ?? (taken ? "That name's taken. Somebody got there first." : null);
  const canSubmit = !nameError(name) && !taken && adult && !pending;

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

  if (locked) {
    return (
      <StepSheet cta={<button className="btn btn-taxi" onClick={onDone}>Continue ›</button>}>
        <div className="card stack-4">
          <p className="title" style={{ margin: 0 }}>Your look is locked in.</p>
          <p className="subtext" style={{ margin: 0 }}>You can change outfits in Your Look once the Shop opens. Your face, though, is forever. Like a tattoo.</p>
        </div>
      </StepSheet>
    );
  }

  const submit = () => {
    setTouched(true);
    setError(null);
    if (!canSubmit) return;
    startTransition(async () => {
      const result = await onSubmit({ name, style: look.style, look: lookChoices(look), ageConfirmed: adult });
      if (result.ok) onDone();
      else setError({ text: result.error, field: result.field });
    });
  };

  return (
    <StepSheet
      cta={
        <button className="btn btn-taxi" onClick={submit} disabled={!canSubmit && touched}>
          {pending ? "Claiming…" : "Claim my name ›"}
        </button>
      }
    >
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
    </StepSheet>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Traits (pick 2; flavor only in P1)
// ---------------------------------------------------------------------------
function TraitsStep({
  traits, setTraits, onSave, onDone,
}: { traits: string[]; setTraits: (t: string[]) => void; onSave: CreatorActions["saveTraits"]; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const full = traits.length >= TRAIT_COUNT;
  const left = TRAIT_COUNT - traits.length;

  const toggle = (id: string) => {
    if (traits.includes(id)) setTraits(traits.filter((t) => t !== id));
    else if (!full) setTraits([...traits, id]);
  };

  return (
    <StepSheet
      cta={
        <button
          className="btn btn-taxi"
          disabled={!full || pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await onSave(traits);
              if (r.ok) onDone();
              else setError(r.error);
            })
          }
        >
          {pending ? "Saving…" : "Continue ›"}
        </button>
      }
    >
      <div className="stack-4">
        <p className="title" style={{ margin: 0 }}>What are you like?</p>
        {full ? (
          <p className="body-strong" style={{ margin: 0, color: "var(--green-text)" }}>Locked in. Very on-brand.</p>
        ) : (
          <p className="meta" style={{ margin: 0, fontSize: 13 }}>Pick {left} more. Purely for vibes; traits don&apos;t change the game.</p>
        )}
      </div>
      <div className="trait-grid" role="group" aria-label="Traits">
        {TRAITS.map((t) => {
          const selected = traits.includes(t.id);
          const dimmed = full && !selected;
          return (
            <button key={t.id} className="select-card multi" aria-pressed={selected} disabled={dimmed} onClick={() => toggle(t.id)}>
              <span className="select-emoji" aria-hidden="true">{t.emoji}</span>
              <span className="title" style={{ display: "block" }}>{t.name}</span>
              <span className="subtext" style={{ display: "block" }}>{t.blurb}</span>
              {selected && <span className="select-check" aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>
      {error && <p className="error-text" role="alert">{error}</p>}
    </StepSheet>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Birth lottery (rolled once per account)
// ---------------------------------------------------------------------------
function LotteryStep({
  cash, onRoll, onRolled, onDone,
}: { cash: number | null; onRoll: CreatorActions["rollBirthLottery"]; onRolled: (n: number) => void; onDone: () => void }) {
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { min, max } = ECONOMY.birthLottery;

  const roll = async () => {
    setError(null);
    setRolling(true);
    const started = Date.now();
    const r = await onRoll();
    // Let the dice tumble for its full 900 ms before the reveal.
    await new Promise((res) => setTimeout(res, Math.max(0, 900 - (Date.now() - started))));
    setRolling(false);
    if (r.ok) onRolled(r.cash);
    else setError(r.error);
  };

  return (
    <StepSheet
      cta={
        cash === null ? (
          <button className="btn btn-taxi" onClick={roll} disabled={rolling}>{rolling ? "Rolling…" : "Roll the dice"}</button>
        ) : (
          <button className="btn btn-taxi" onClick={onDone}>Find a place ›</button>
        )
      }
    >
      {cash === null ? (
        <div className="stack-16 center">
          <div className={`dice-tile${rolling ? " rolling" : ""}`} aria-hidden="true">🎲</div>
          <div className="stack-4">
            <p className="title" style={{ margin: 0 }}>Life isn&apos;t fair. Neither is this.</p>
            <p className="subtext" style={{ margin: 0 }}>
              Roll for your starting cash: anywhere from <strong>{formatCash(min)}</strong> to <strong>{formatCash(max)}</strong>.
            </p>
          </div>
          <p className="meta" style={{ margin: 0 }}>🔒 Rolled once per account. No rerolls, no refunds, no therapy.</p>
        </div>
      ) : (
        <div className="reveal-card" role="status">
          <span className="tag tag-positive">Starting cash</span>
          <p className="display-xl" style={{ margin: "12px 0 6px" }}>{formatCash(cash)}</p>
          <p className="body" style={{ margin: 0, color: "rgba(255,246,224,.8)" }}>{lotteryLine(cash)}</p>
        </div>
      )}
      {error && <p className="error-text" role="alert">{error}</p>}
    </StepSheet>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Home (single choice; homes you can't afford are disabled)
// ---------------------------------------------------------------------------
function HomeStep({ cash, onMoveIn, onDone }: { cash: number; onMoveIn: CreatorActions["moveIn"]; onDone: () => void }) {
  const firstAffordable = ECONOMY.homes.find((h) => canAfford(h, cash))?.id ?? null;
  const [pick, setPick] = useState<string | null>(firstAffordable);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <StepSheet
      cta={
        <button
          className="btn btn-green"
          disabled={!pick || pending}
          onClick={() =>
            pick &&
            startTransition(async () => {
              setError(null);
              const r = await onMoveIn(pick);
              if (r.ok) onDone();
              else setError(r.error);
            })
          }
        >
          {pending ? "Moving in…" : "Move in"}
        </button>
      }
    >
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <p className="title" style={{ margin: 0 }}>Pick a place in Queens</p>
        <span className="body-strong">{formatCash(cash)}</span>
      </div>
      <div className="stack-12" role="radiogroup" aria-label="Homes">
        {ECONOMY.homes.map((h) => {
          const ok = canAfford(h, cash);
          const selected = pick === h.id;
          return (
            <button
              key={h.id}
              role="radio"
              aria-checked={selected}
              className={`select-card single${ok ? "" : " unaffordable"}`}
              disabled={!ok}
              onClick={() => setPick(h.id)}
            >
              <span className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                <span className="select-emoji" aria-hidden="true">{h.emoji}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="title" style={{ display: "block" }}>
                    {h.name.replace(` ${h.neighborhood}`, "")}{" "}
                    <span style={{ fontWeight: 400, color: "var(--text-3)" }}>in {h.neighborhood}</span>
                  </span>
                  <span className="subtext" style={{ display: "block" }}>{h.blurb}</span>
                  <span className="meta" style={{ display: "block", marginTop: 4 }}>
                    Rent <strong className={ok ? "" : "price-bad"}>{formatCash(h.rent)}</strong>/mo
                    {!ok && " · Leaves too little for this month"}
                  </span>
                </span>
              </span>
              {selected && <span className="info-badge">Your pick</span>}
            </button>
          );
        })}
      </div>
      <p className="meta" style={{ margin: 0 }}>Moving in pays your first rent. Your phone bill comes later. The landlord never forgets.</p>
      {error && <p className="error-text" role="alert">{error}</p>}
    </StepSheet>
  );
}

// ---------------------------------------------------------------------------
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
          <button key={c} className="swatch" style={{ background: c }} aria-pressed={value === c} aria-label={`${label} ${i + 1}`} onClick={() => onPick(c)} />
        ))}
      </div>
    </div>
  );
}
