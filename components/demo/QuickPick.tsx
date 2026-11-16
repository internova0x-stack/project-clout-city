"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ECONOMY } from "@/lib/economy";
import { BODIES, BUILDS, DEFAULT_BUILD, HAIR_COLORS, SKIN_TONES, SKIN_WEIGHTS, randomLook, weightedIndex, type BodyId, type BuildId, type GlassesId, type HairId, type Look } from "@/lib/look";
import { STYLE_IDS, type StyleId } from "@/lib/styles";
import { keepGuestLook } from "@/lib/guestLook";

const Avatar3D = dynamic(() => import("@/components/avatar/Avatar3D"), { ssr: false });

// The guest's ready-made New Yorkers (owner, Nov 16: "actual looks… Nerdy, Sporty, Gothic, Casual, Street, Future mogul…
// and they should be gender relevant"). One look per starting outfit, each with its own him and her: hair, build, glasses
// and a line that fit. Skin is the guest's own pick (any of the eight tones), never part of a look. Nothing here is saved.

interface Side {
  label: string;
  line: string;
  hair: HairId;
  build: BuildId;
  glasses?: GlassesId;
  cap?: boolean;
  /** A fixed hair colour (goth black); otherwise the face's own. */
  hairColor?: string;
  handles: string[];
}

export interface QuickLook { id: string; emoji: string; style: StyleId; him: Side; her: Side }

export const LOOKS: QuickLook[] = [
  { id: "casual", emoji: "😎", style: "startup_founder",
    him: { label: "Casual", line: "Tee, jeans, no plans. The plan is no plans.", hair: "short", build: "athletic", handles: ["NoPlansNico", "JustVibingJay", "ChillSinceBirth"] },
    her: { label: "Casual", line: "Tee, jeans, iced coffee in January.", hair: "long", build: "curvy", handles: ["IcedCoffeeIzzy", "NoPlansNina", "SoftLaunchSam"] } },
  { id: "sporty", emoji: "🏃", style: "pilates_princess",
    him: { label: "Sporty", line: "Leg day is every day. Ask him about it.", hair: "buzz", build: "athletic", handles: ["NeverSkipLegDay", "ProteinPete", "RunClubRay"] },
    her: { label: "Sporty", line: "Pilates at six, matcha at seven, smug by eight.", hair: "ponytail", build: "athletic", handles: ["PilatesAt6", "MatchaMia", "RunClubRosa"] } },
  { id: "street", emoji: "🧢", style: "bodega_drip",
    him: { label: "Street", line: "Knows the deli cat by name. The cat doesn't know him.", hair: "short", build: "broad", cap: true, handles: ["BaconEggCheese", "DeliCatWhisperer", "CornerStoreSage"] },
    her: { label: "Street", line: "In line for the sneaker drop since 4 AM.", hair: "braids", build: "curvy", handles: ["SneakerDropSade", "BodegaBaddie", "Lines4Days"] } },
  { id: "nerdy", emoji: "🤓", style: "arcade_nerd",
    him: { label: "Nerdy", line: "High score on every machine in Astoria. Low score in sunlight.", hair: "short", build: "slim", glasses: "square", handles: ["HighScoreHank", "Player2Pending", "CtrlAltDev"] },
    her: { label: "Nerdy", line: "Has actually read the terms and conditions.", hair: "bun", build: "petite", glasses: "round", handles: ["ReadTheTerms", "SideQuestSue", "BookClubBoss"] } },
  { id: "gothic", emoji: "🦇", style: "night_owl_goth",
    him: { label: "Gothic", line: "Hasn't seen the sun since 2019. Thriving.", hair: "long", build: "slim", hairColor: HAIR_COLORS[0], handles: ["NoSunSince2019", "VampireHours", "MidnightMarcus"] },
    her: { label: "Gothic", line: "Black lipstick, black coffee, black cat. Thriving.", hair: "long", build: "petite", hairColor: HAIR_COLORS[0], handles: ["BlackCoffeeBella", "VampireHours", "NightOwlNoor"] } },
  { id: "mogul", emoji: "💼", style: "midtown_finance",
    him: { label: "Future mogul", line: "Two phones. One is for the other phone. Bullish.", hair: "short", build: "broad", handles: ["BullishBrad", "VestedInterest", "CircleBackChad"] },
    her: { label: "Future mogul", line: "Corner office by 30. It's already in her calendar.", hair: "bun", build: "petite", handles: ["GirlBossGains", "HedgeFundHer", "PowerSuitPending"] } },
  { id: "glam", emoji: "💸", style: "influencer_soft_glam",
    him: { label: "Flashy", line: "Got rich last Tuesday. Has mentioned it since Tuesday.", hair: "short", build: "athletic", glasses: "shades", handles: ["RichSinceTuesday", "JustGotTheBag", "DripCheckDev"] },
    her: { label: "Glam", line: "Link in bio. The bio is a link to another bio.", hair: "long", build: "curvy", glasses: "shades", handles: ["LinkInBio", "SoftGlamSofia", "MainCharacterMo"] } },
  { id: "artsy", emoji: "🎨", style: "thrift_store_icon",
    him: { label: "Artsy", line: "Paid C$4 for this cardigan. Will tell you about it.", hair: "locs", build: "slim", handles: ["RentIsArt", "GalleryPending", "ThriftedTheo"] },
    her: { label: "Artsy", line: "Her rent is art. Her art is not rent.", hair: "curls", build: "plus", glasses: "round", handles: ["ThriftedAndBroke", "GalleryPending", "CardiganKat"] } },
];

export interface QuickCharacter { name: string; look: Look; cash: number; homeId: string; traits: string[] }

const sideOf = (l: QuickLook, body: BodyId) => (body === "curvy" ? l.her : l.him);
export const lookLabel = (l: QuickLook, body: BodyId) => sideOf(l, body).label;

/** The look on a face: the face's colours, the look's hair, build, glasses and outfit, the guest's skin. */
export function lookOn(l: QuickLook, body: BodyId, skin: string, face: Look): Look {
  const s = sideOf(l, body);
  // Hair colour follows the skin: on the six darker tones a blonde, platinum or auburn face goes dark brown.
  const light = SKIN_TONES.indexOf(skin as (typeof SKIN_TONES)[number]) <= 1;
  const fair = ([HAIR_COLORS[3], HAIR_COLORS[4], HAIR_COLORS[5]] as string[]).includes(face.hairColor);
  const hairColor = s.hairColor ?? (!light && fair ? HAIR_COLORS[1] : face.hairColor);
  return {
    ...face, style: l.style, body, build: s.build, skin, hair: s.hair, hairColor,
    glasses: s.glasses ?? "none", covering: s.cap ? "cap" : "none", fit: null,
  };
}

function finish(l: QuickLook, look: Look): QuickCharacter {
  const { min, max, step } = ECONOMY.birthLottery;
  const cash = min + step * Math.floor(Math.random() * ((max - min) / step + 1));
  const { handles } = sideOf(l, look.body);
  const handle = handles[Math.floor(Math.random() * handles.length)];
  return { name: `${handle}_${1000 + Math.floor(Math.random() * 9000)}`, look, cash, homeId: "astoria_share", traits: [] };
}

const PICK_KEY = "cc-demo-character";
const randomSkin = () => SKIN_TONES[weightedIndex(SKIN_WEIGHTS, Math.random())];

/** Keeps the guest's character for this visit (the demo and the avatar preload read it). */
export function keepCharacter(c: QuickCharacter) {
  try { sessionStorage.setItem(PICK_KEY, JSON.stringify(c)); } catch { /* private mode */ }
}

/** Keeps the look the guest picked for the creator (lib/guestLook.ts), when they tap Sign up. */
export function carryLookToSignUp() { keepGuestLook(defaultCharacter().look); }

/**
 * Owner, Nov 7: the demo starts as a ready-made New Yorker, chosen once per visit and kept in sessionStorage, so the guest
 * screen can download that avatar's files early. A guest who picked one in the Go sheet keeps their pick.
 */
export function defaultCharacter(): QuickCharacter {
  try {
    const kept = sessionStorage.getItem(PICK_KEY);
    if (kept) return JSON.parse(kept) as QuickCharacter;
  } catch { /* private mode */ }
  const l = LOOKS[Math.floor(Math.random() * LOOKS.length)];
  const body: BodyId = Math.random() < 0.5 ? "curvy" : "straight";
  const c = finish(l, lookOn(l, body, randomSkin(), randomLook(Math.random, STYLE_IDS)));
  keepCharacter(c);
  return c;
}

/**
 * The guest's quick pick (owner, Nov 16, recommendation 4): him or her, one of the eight looks, any skin tone, on a live
 * avatar. Starts on the character already chosen for this visit, so a guest who just taps on keeps it.
 */
export function LookPicker({ onChange }: { onChange?: (c: QuickCharacter) => void }) {
  // Owner, Nov 16: four named layers, each its own choice: Gender, Shape (the body type), Skin tone, Style. A style brings
  // its hair and glasses; the shape stays what the guest picked.
  const start = useMemo(() => defaultCharacter(), []);
  const [face] = useState<Look>(start.look);
  const [body, setBody] = useState<BodyId>(start.look.body);
  const [build, setBuild] = useState<BuildId>(start.look.build);
  const [skin, setSkin] = useState<string>(start.look.skin);
  const [lookId, setLookId] = useState<string>(() => LOOKS.find((l) => l.style === start.look.style)?.id ?? LOOKS[0].id);
  const l = LOOKS.find((x) => x.id === lookId) ?? LOOKS[0];
  const look = { ...lookOn(l, body, skin, face), build };

  const choose = (next: { body?: BodyId; build?: BuildId; skin?: string; lookId?: string }) => {
    const nl = LOOKS.find((x) => x.id === (next.lookId ?? lookId)) ?? LOOKS[0];
    const nb = next.body ?? body;
    // A shape the other gender doesn't have becomes that gender's default.
    const nbuild = next.build ?? (BUILDS[nb].some((o) => o.id === build) ? build : DEFAULT_BUILD[nb]);
    if (next.body) setBody(next.body);
    setBuild(nbuild);
    if (next.skin) setSkin(next.skin);
    if (next.lookId) setLookId(next.lookId);
    const c = finish(nl, { ...lookOn(nl, nb, next.skin ?? skin, face), build: nbuild });
    keepCharacter(c);
    onChange?.(c);
  };

  return (
    <div className="look-pick">
      <div className="look-pick-stage">
        <Avatar3D look={look} framing="full" />
        <span className="look-pick-tag">{l.emoji} {lookLabel(l, body)}</span>
      </div>
      <section className="look-pick-layer" aria-label="Gender">
        <p className="look-pick-title">Gender</p>
        <div className="look-pick-row" role="radiogroup" aria-label="Gender">
          {BODIES.map((o) => (
            <button key={o.id} role="radio" aria-checked={body === o.id} className="look-pick-chip" onClick={() => choose({ body: o.id })}>{o.label}</button>
          ))}
        </div>
      </section>
      <section className="look-pick-layer" aria-label="Shape">
        <p className="look-pick-title">Shape</p>
        <div className="look-pick-row" role="radiogroup" aria-label="Shape">
          {BUILDS[body].map((o) => (
            <button key={o.id} role="radio" aria-checked={build === o.id} className="look-pick-chip" onClick={() => choose({ build: o.id })}>{o.label}</button>
          ))}
        </div>
      </section>
      <section className="look-pick-layer" aria-label="Skin tone">
        <p className="look-pick-title">Skin tone</p>
        <div className="look-pick-skins" role="radiogroup" aria-label="Skin tone">
          {SKIN_TONES.map((t, i) => (
            <button key={t} role="radio" aria-checked={t === skin} aria-label={`Skin tone ${i + 1}`} className="look-pick-skin" style={{ background: t }} onClick={() => choose({ skin: t })} />
          ))}
        </div>
      </section>
      <section className="look-pick-layer" aria-label="Style">
        <p className="look-pick-title">Style <span className="look-pick-sub">{sideOf(l, body).line}</span></p>
        <div className="look-pick-row" role="radiogroup" aria-label="Style">
          {LOOKS.map((x) => (
            <button key={x.id} role="radio" aria-checked={x.id === lookId} className="look-pick-chip" onClick={() => choose({ lookId: x.id })}>
              <span aria-hidden="true">{x.emoji}</span>{lookLabel(x, body)}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
