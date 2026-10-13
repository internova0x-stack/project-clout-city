"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import type { CreateResult } from "@/app/create/actions";
import { ECONOMY, TRAITS, TRAIT_COUNT, canAfford, formatCash, lotteryLine } from "@/lib/economy";
import {
  BODIES, BUILDS, DEFAULT_BUILD, DEFAULT_LOOK, EYE_COLORS, GLASSES, HAIRS, HAIR_COLORS, HEADWEAR_BASIC, HEADWEAR_CULTURAL, SKIN_TONES,
  lookChoices, randomLook, type BuildId, type Look, type LookChoices,
} from "@/lib/look";
import { BOTTOM_LABEL, STARTING_STYLES, STYLE_FITS, STYLE_IDS, TOP_LABEL, defaultFit, getStyle, type BottomKind, type Fit, type TopKind } from "@/lib/styles";
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
  initialName,
}: {
  needsAgeConfirm: boolean;
  actions: CreatorActions;
  initialStep?: CreatorStep;
  initialLook?: Look;
  initialTraits?: string[] | null;
  initialCash?: number | null;
  /** The claimed username (for the starting-cash card when resuming). */
  initialName?: string | null;
}) {
  const router = useRouter();
  const [handleName, setHandleName] = useState(initialName ?? "");
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
            onDone={(name) => { setHandleName(name); advance(1); }}
          />
        )}
        {step === 1 && <TraitsStep traits={traits} setTraits={setTraits} onSave={actions.saveTraits} onDone={() => advance(2)} />}
        {step === 2 && <LotteryStep cash={cash} handle={handleName} onRoll={actions.rollBirthLottery} onRolled={setCash} onDone={() => advance(3)} />}
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
  onDone: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [adult, setAdult] = useState(!needsAgeConfirm);
  const [touched, setTouched] = useState(false);
  const [taken, setTaken] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const style = getStyle(look.style);
  const set = <K extends keyof Look>(key: K, value: Look[K]) => setLook((l) => ({ ...l, [key]: value }));
  // Switching presentation also swaps the default hair (short <-> long), so the change is
  // visible at once; any other hair the player picked stays.
  const setPresenting = (body: Look["body"]) =>
    setLook((l) => ({
      ...l,
      body,
      // Athletic exists for both; Slim/Broad and Petite/Curvy swap to the other presentation's default.
      build: BUILDS[body].some((b) => b.id === l.build) ? l.build : DEFAULT_BUILD[body],
      hair: body === "curvy" && (l.hair === "short" || l.hair === "buzz") ? "long" : body === "straight" && l.hair === "long" ? "short" : l.hair,
    }));
  const localError = touched ? nameError(name) : null;
  const nameMessage = error?.field === "name" ? error.text : localError ?? (taken ? "That username's taken. Somebody got there first." : null);
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
      <StepSheet cta={<button className="btn btn-taxi" onClick={() => onDone("")}>Continue ›</button>}>
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
      if (result.ok) onDone(cleanName(name));
      else setError({ text: result.error, field: result.field });
    });
  };

  return (
    <StepSheet
      cta={
        <button className="btn btn-taxi" onClick={submit} disabled={!cleanName(name) || (!canSubmit && touched)}>
          {pending ? "Claiming…" : "Claim my username ›"}
        </button>
      }
    >
      <div className="stack-8">
        <label className="title" htmlFor="name" style={{ margin: 0 }}>Pick your username</label>
        <div className={`field field-outline${nameMessage ? " error" : ""}`}>
          <span className="field-at" aria-hidden="true">@</span>
          <input
            id="name"
            value={name}
            maxLength={21}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="yourname"
            onChange={(e) => {
              setName(e.target.value);
              if (error?.field === "name") setError(null);
            }}
            onBlur={() => setTouched(true)}
          />
          <span className="hint">{name ? `${cleanName(name).length}/20` : "how the city knows you"}</span>
        </div>
        {nameMessage && <p className="error-text" role="alert" style={{ margin: 0 }}>{nameMessage}</p>}
      </div>

      <div className="stack-8">
        <p className="overline" style={{ margin: 0 }}>Presenting as</p>
        <div className="binary" role="group" aria-label="Presenting as">
          {BODIES.map((o) => (
            <button key={o.id} aria-pressed={look.body === o.id} onClick={() => setPresenting(o.id)}>{o.label}</button>
          ))}
        </div>
      </div>

      <div className="stack-8">
        <p className="overline" style={{ margin: 0 }}>Body type</p>
        <div className="build-tiles" role="radiogroup" aria-label="Body type">
          {BUILDS[look.body].map((o) => (
            <button key={o.id} role="radio" aria-checked={look.build === o.id} className="build-tile" onClick={() => set("build", o.id)}>
              <BodySilhouette build={o.id} fem={look.body === "curvy"} />
              <span>{o.label}</span>
              {look.build === o.id && <span className="build-tick" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
        <p className="meta" style={{ margin: 0 }}>Every outfit fits every body. Purely how you look; it never changes the game.</p>
      </div>

      <div className="stack-8">
        <p className="overline" style={{ margin: 0 }}>Starting style</p>
        <div className="chip-row" role="group" aria-label="Starting style" style={{ margin: "0 -20px", padding: "2px 20px" }}>
          {STARTING_STYLES.map((s) => (
            <button key={s.id} className="chip" aria-pressed={look.style === s.id} onClick={() => setLook((l) => ({ ...l, style: s.id, fit: null }))}>
              <span aria-hidden="true">{s.emoji}</span> {s.label}
            </button>
          ))}
        </div>
        <p className="subtext" style={{ margin: 0 }} key={style.id}><strong style={{ color: "var(--text-1)" }}>{style.label}.</strong> {style.blurb}</p>
      </div>

      <OutfitPicker look={look} onChange={(fit) => set("fit", fit)} />

      <div className="stack-8">
        <p className="overline" style={{ margin: 0 }}>Headwear · all free</p>
        <div className="option-chips" role="group" aria-label="Headwear">
          {HEADWEAR_BASIC.map((o) => (
            <button key={o.id} className="chip" aria-pressed={look.covering === o.id} onClick={() => set("covering", o.id)}>{HAT_EMOJI[o.id] ?? ""}{o.label}</button>
          ))}
        </div>
        <p className="creator-label">Cultural and religious</p>
        <div className="option-chips" role="group" aria-label="Cultural and religious coverings">
          {HEADWEAR_CULTURAL.map((o) => (
            <button key={o.id} className="chip" aria-pressed={look.covering === o.id} onClick={() => set("covering", o.id)}>{o.label}</button>
          ))}
        </div>
        <p className="meta" style={{ margin: 0 }}>Premium hats live in the Shop.</p>
      </div>

      <OptionGroup label="Hair" options={HAIRS} value={look.hair} onPick={(v) => set("hair", v)} />
      <Swatches label="Skin" colors={SKIN_TONES} value={look.skin} onPick={(v) => set("skin", v)} />
      <Swatches label="Hair color" colors={HAIR_COLORS} value={look.hairColor} onPick={(v) => set("hairColor", v)} />
      <Swatches label="Eyes" colors={EYE_COLORS} value={look.eyes} onPick={(v) => set("eyes", v)} />
      <OptionGroup label="Glasses" options={GLASSES} value={look.glasses} onPick={(v) => set("glasses", v)} />
      <p className="meta" style={{ margin: 0 }}>Body, hair, glasses and headwear are free for everyone, forever. The Shop will never sell them.</p>

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
  cash, handle, onRoll, onRolled, onDone,
}: { cash: number | null; handle: string; onRoll: CreatorActions["rollBirthLottery"]; onRolled: (n: number) => void; onDone: () => void }) {
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
        <CashCard cash={cash} handle={handle} />
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
          className="btn btn-taxi"
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
// v0.7 creator pieces: body-type silhouettes, the starter outfit picker, the starting-cash card
// ---------------------------------------------------------------------------
const HAT_EMOJI: Partial<Record<Look["covering"], string>> = { cap: "🧢 ", fedora: "🎩 ", bucket: "👒 " };

/** Half-widths at the shoulder, chest, waist and hip (and thigh), plus height, per body type. */
const SILHOUETTE: Record<"m" | "f", Record<string, { sh: number; ch: number; wa: number; hi: number; th: number; h: number; bust?: number; belly?: number }>> = {
  m: {
    slim: { sh: 8.5, ch: 7, wa: 6, hi: 7, th: 5.5, h: 1.02 },
    athletic: { sh: 15, ch: 13, wa: 8.5, hi: 9.5, th: 8, h: 1 },
    broad: { sh: 18.5, ch: 17.5, wa: 15, hi: 14, th: 11, h: 0.97 },
    plus: { sh: 14, ch: 15, wa: 14, hi: 15, th: 12, h: 0.95, belly: 6 },
  },
  f: {
    petite: { sh: 8, ch: 7, wa: 5.5, hi: 8, th: 5.5, h: 0.78, bust: 0.5 },
    athletic: { sh: 12, ch: 10.5, wa: 8, hi: 10.5, th: 8, h: 0.98, bust: 1 },
    curvy: { sh: 11, ch: 11, wa: 6.5, hi: 17, th: 10.5, h: 0.95, bust: 4 },
    plus: { sh: 14, ch: 15, wa: 14.5, hi: 18, th: 12.5, h: 0.94, bust: 3.5, belly: 4 },
  },
};

function BodySilhouette({ build, fem }: { build: BuildId; fem: boolean }) {
  const p = SILHOUETTE[fem ? "f" : "m"][build] ?? SILHOUETTE.m.athletic;
  const cx = 30, top = 100 - 88 * p.h, y = (t: number) => top + (100 - top) * t;
  const L = (w: number) => cx - w, R = (w: number) => cx + w;
  const bust = p.bust ?? 0, belly = p.belly ?? 0;
  const torso = `M${L(4)},${y(0.15)} C${L(p.sh)},${y(0.16)} ${L(p.sh)},${y(0.18)} ${L(p.sh)},${y(0.21)}
    C${L(p.ch + bust)},${y(0.3)} ${L(p.wa + belly)},${y(0.4)} ${L(p.wa + belly)},${y(0.46)}
    C${L(p.hi)},${y(0.53)} ${L(p.hi)},${y(0.56)} ${L(p.hi)},${y(0.6)}
    L${L(p.th)},${y(0.99)} L${cx - 1.5},${y(0.99)} L${cx},${y(0.66)} L${cx + 1.5},${y(0.99)} L${R(p.th)},${y(0.99)}
    L${R(p.hi)},${y(0.6)} C${R(p.hi)},${y(0.56)} ${R(p.hi)},${y(0.53)} ${R(p.wa + belly)},${y(0.46)}
    C${R(p.wa + belly)},${y(0.4)} ${R(p.ch + bust)},${y(0.3)} ${R(p.sh)},${y(0.21)} C${R(p.sh)},${y(0.18)} ${R(p.sh)},${y(0.16)} ${R(4)},${y(0.15)} Z`;
  const arm = (d: number) => `M${cx + d * p.sh},${y(0.2)} L${cx + d * (p.sh + 3.5)},${y(0.52)} L${cx + d * (p.sh + 0.8)},${y(0.53)} L${cx + d * (p.sh - 1.5)},${y(0.27)} Z`;
  return (
    <svg viewBox="0 0 60 100" width="44" height="72" aria-hidden="true">
      <circle cx={cx} cy={y(0.07)} r={7.2 * (0.9 + 0.1 * p.h)} />
      <path d={torso} /><path d={arm(-1)} /><path d={arm(1)} />
    </svg>
  );
}

const GARMENT: Record<TopKind | BottomKind, ReactNode> = {
  puffer: <><path d="M14 10 L24 6 L36 6 L46 10 L52 34 L44 36 L42 22 L42 50 L18 50 L18 22 L16 36 L8 34 Z" /><path d="M18 20 H42 M18 30 H42 M18 40 H42" stroke="#fff" strokeWidth="2.4" fill="none" opacity=".55" /></>,
  hoodie: <><path d="M22 6 Q30 0 38 6 L46 10 L52 34 L44 36 L42 22 L42 50 L18 50 L18 22 L16 36 L8 34 L14 10 Z" /><path d="M24 7 Q30 16 36 7" stroke="#fff" strokeWidth="2.2" fill="none" opacity=".6" /></>,
  zip: <><path d="M14 10 L24 6 L36 6 L46 10 L52 34 L44 36 L42 22 L42 50 L18 50 L18 22 L16 36 L8 34 Z" /><path d="M30 8 V50" stroke="#fff" strokeWidth="2" opacity=".7" /></>,
  cardigan: <><path d="M14 10 L24 6 L30 14 L36 6 L46 10 L52 36 L44 38 L42 22 L42 50 L18 50 L18 22 L16 38 L8 36 Z" /><circle cx="30" cy="24" r="1.6" fill="#fff" opacity=".7" /><circle cx="30" cy="34" r="1.6" fill="#fff" opacity=".7" /></>,
  vest: <><path d="M20 6 L30 22 L40 6 L44 12 L42 50 L18 50 L16 12 Z" /></>,
  crop: <><path d="M16 12 L24 8 L36 8 L44 12 L48 26 L42 27 L41 20 L41 32 L19 32 L19 20 L18 27 L12 26 Z" /></>,
  blazer: <><path d="M14 10 L24 6 L30 26 L36 6 L46 10 L52 36 L44 38 L42 22 L42 50 L18 50 L18 22 L16 38 L8 36 Z" /><path d="M24 6 L30 26 L36 6" stroke="#fff" strokeWidth="2" fill="none" opacity=".5" /></>,
  tee: <><path d="M14 10 L24 6 L36 6 L46 10 L52 20 L44 24 L42 20 L42 50 L18 50 L18 20 L16 24 L8 20 Z" /></>,
  pants: <path d="M18 4 H42 L44 52 H33 L30 18 L27 52 H16 Z" />,
  shorts: <path d="M18 10 H42 L45 38 H33 L30 22 L27 38 H15 Z" />,
  skirt: <path d="M21 10 H39 L48 44 H12 Z" />,
  leggings: <path d="M20 4 H40 L39 52 H32 L30 16 L28 52 H21 Z" />,
};

/** The starter outfit (v0.7, #45): three tops and bottoms per style, six colors each, plus shoes. */
function OutfitPicker({ look, onChange }: { look: Look; onChange: (fit: Fit) => void }) {
  const style = getStyle(look.style);
  const o = STYLE_FITS[style.id];
  const fit = look.fit ?? defaultFit(style, look.body);
  const pick = (patch: Partial<Fit>) => onChange({ ...fit, ...patch });
  const piece = (kinds: (TopKind | BottomKind)[], value: string, color: string, label: (k: TopKind | BottomKind) => string, on: (k: TopKind | BottomKind) => void) => (
    <div className="garment-row" role="radiogroup">
      {kinds.map((k) => (
        <button key={k} role="radio" aria-checked={value === k} className="garment" onClick={() => on(k)}>
          <svg viewBox="0 0 60 56" width="40" height="38" fill={value === k ? color : "#C9C0B5"} aria-hidden="true">{GARMENT[k]}</svg>
          <span>{label(k)}</span>
        </button>
      ))}
    </div>
  );
  return (
    <div className="stack-8">
      <p className="overline" style={{ margin: 0 }}>Your starter outfit · free</p>
      <div className="outfit-panel stack-8">
        <span className="outfit-label">Top</span>
        {piece(o.tops, fit.top, fit.topColor, (k) => TOP_LABEL[k as TopKind], (k) => pick({ top: k as TopKind }))}
        <OutfitSwatches label="Top color" colors={o.topColors} value={fit.topColor} onPick={(c) => pick({ topColor: c })} />
      </div>
      <div className="outfit-panel stack-8">
        <span className="outfit-label">Bottom</span>
        {piece(o.bottoms, fit.bottom, fit.bottomColor, (k) => BOTTOM_LABEL[k as BottomKind], (k) => pick({ bottom: k as BottomKind }))}
        <OutfitSwatches label="Bottom color" colors={o.bottomColors} value={fit.bottomColor} onPick={(c) => pick({ bottomColor: c })} />
      </div>
      <div className="outfit-panel stack-8">
        <span className="outfit-label">Shoes</span>
        <OutfitSwatches label="Shoe color" colors={o.shoeColors} value={fit.shoeColor} onPick={(c) => pick({ shoeColor: c })} />
      </div>
    </div>
  );
}

function OutfitSwatches({ label, colors, value, onPick }: { label: string; colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div className="swatches outfit-swatches" role="group" aria-label={label}>
      {colors.map((c, i) => (
        <button key={c} className="swatch" style={{ background: c }} aria-pressed={value === c} aria-label={`${label} ${i + 1}`} onClick={() => onPick(c)} />
      ))}
    </div>
  );
}

/** The birth lottery's reveal (v0.7, #46): a bright virtual card, after the best banking apps. */
function CashCard({ cash, handle }: { cash: number; handle: string }) {
  const { min, max } = ECONOMY.birthLottery;
  const luckier = Math.round(Math.min(99, Math.max(1, ((cash - min) / Math.max(1, max - min)) * 100)));
  let h = 0;
  for (const ch of handle || "clout") h = (h * 31 + ch.charCodeAt(0)) % 10000;
  return (
    <div className="cash-reveal" role="status">
      <p className="cash-kicker">Your starting balance</p>
      <p className="cash-amount">{formatCash(cash)}</p>
      <span className="cash-luck">🎉 Luckier than {luckier}% of new arrivals</span>
      <div className="cash-card-wrap" aria-hidden="true">
        {["#FFC21A", "#40B589", "#7C4DFF", "#FF8A65", "#FFC21A", "#40B589", "#7C4DFF"].map((c, i) => (
          <span key={i} className={`confetti c${i}`} style={{ background: c }} />
        ))}
        <div className="cash-card">
          <span className="cash-card-mark">CLOUT CITY</span>
          <svg className="cash-card-wave" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <path d="M8 6a8 8 0 0 1 0 12M12 4a12 12 0 0 1 0 16M4 8.5a4 4 0 0 1 0 7" />
          </svg>
          <span className="cash-card-chip" />
          <span className="cash-card-num">•••• {String(h).padStart(4, "0")}</span>
          <span className="cash-card-who">{handle ? `@${handle}` : "New arrival"}</span>
          <span className="cash-card-tag">VIRTUAL · C$</span>
        </div>
      </div>
      <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>{lotteryLine(cash)}</p>
    </div>
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
