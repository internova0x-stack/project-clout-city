# Clout City: Design System Guide (v2)

Oct 11, 2026 · @Internovatechnologies

This is the clean builder spec for Clout City's UI: give this version to Claude Code.

> **Updates (Oct 12, 2026), decided by the product owner; these win over the sections below:**
> 1. **Primary button color:** the one loud button uses an Apple Music red gradient (#FA2D48 to #D41834) with a white label, instead of taxi yellow. Taxi yellow remains the clout color and an accent.
> 2. **In-world chrome:** the HUD, nav bar, side column, stats panel, pills, map pins and guest screen use near-white frosted glass with dark text (iOS-style, after the Lagos Life reference) instead of dark glass. The active nav tab is a night-900 pill with white text. Dark glass remains for the avatar stage and reveal cards.
> 3. **Avatars:** low-poly, flat-shaded figures with natural proportions (head about a sixth of the height), after the Lagos Life reference, instead of the chibi style in section 11. It keeps the reference games' structure (frosted pills over a living world, bottom sheets for reading and deciding, one loud button per screen) in Clout City's own brand: New York at night, taxi yellow, neon magenta, and gold reserved for real money. Game rules come from Clarifications & Updates (v2); where this guide and that document disagree on behavior, Clarifications wins.

Sizes were converted from 499 px reference screenshots to iPhone points (1 pt ≈ 1.28 px, 390 pt viewport); treat them as ±2 pt.

## 1. Design principles

Seven principles carry every screen.

1. **Glass over the world.** HUD, pills, live ticker and info panels are translucent, so the city always shows through.
2. **Pills are the atom.** Map labels, live updates, close buttons, chips, tags and the HUD are fully rounded capsules.
3. **Two weights of text, always.** Every block pairs a dark bold main line with lighter grey subtext.
4. **One loud button per screen.** A single colored primary (taxi yellow, green or night) plus quiet secondaries.
5. **Gold means real money.** Gold appears only on real-cash products (section 3), so players can always tell real money from virtual cash at a glance.
6. **Delight through emoji, gradients and wit.** Emoji replace many icons, gradient banners mark special moments, and the copy is funny.
7. **Characters are the hero.** Avatars are rendered in soft, high-fidelity 3D on a stage, so the effort goes where players form attachment. The P1 map is 2D.

## 2. Brand layer

The key art ("Clout City NYC — Tap in. Blow up") sets a night-time, high-energy New York mood; the system borrows the reference games' friendliness and layout, and swaps their calm palette for taxi yellow, neon and night.

### Brand DNA from the key art

| Element in the key art | Becomes in the UI |
| --- | --- |
| Rainy night street, bridge, warm black sky | Dark glass chrome (HUD, nav, pills), the 2D night map, and a night stage behind avatars |
| Gold beveled "CLOUT CITY" wordmark | The logo asset, and the gold-metal gradient, used only for real-cash products |
| Black "NYC" badge with gold outline | Night-900 badges and tags with a 1.5 pt cream stroke at 14% |
| Hazard-stripe banner behind "TAP IN. BLOW UP" | Hazard-stripe accent for announcements, closures, locked boroughs and "Coming soon" |
| Yellow cabs | Taxi yellow is the primary action color and the clout color |
| Pink and magenta neon signs | Neon magenta for LIVE, notifications, nightlife and events |
| Wet-street reflections | Subtle colored glow under primary buttons and pins (30 to 40%) |

### What stays from the reference vs what changes

| Area | Kept from the reference | Changed for Clout City |
| --- | --- | --- |
| Layout | Floating HUD, floating nav, sheets over the world, phone modal, step-by-step onboarding | Four-step creator; fixed side icon column |
| Shapes | Pills, radius scale, spacing grid, card anatomy | Real-cash items get a thin gold stroke; nothing else does |
| Sheets | Light sheets for readability | Warm cream instead of cool grey |
| In-world chrome | Translucent glass | Dark glass instead of light, to sit on the night city |
| Primary action | One loud colored button | Taxi yellow with night text instead of red with white |
| Headings | A characterful display face over a clean UI sans | Bungee (NYC signage) instead of a soft serif |
| Delight | Emoji, gradients, witty copy | Neon and taxi gradients; NYC-flavored copy and emoji (🚕 🗽 🍕 🌉) |

### Logo and tagline

- Use the wordmark as an image asset (PNG or WebP with transparency); never rebuild the bevel in CSS.
- Minimum width 160 pt; keep clear space equal to the height of the "NYC" badge on all sides.
- Place it only on dark or photographic backgrounds (splash, guest map, share cards).
- The tagline "TAP IN. BLOW UP" appears in Barlow Condensed 700, uppercase, gold-300 on a night bar edged with hazard stripes. The logo and tagline are the only decorative uses of gold.

## 3. Color system

The palette is warm night blacks, warm cream neutrals and four brand accents: taxi yellow (act and clout), neon magenta (live), green (money in) and gold (real money only).

### Core tokens

| Token | Hex | Use |
| --- | --- | --- |
| night-900 | #14111A | Selected chips and cards, dark buttons, badges, the binary toggle's selected pill |
| night-800 | #1F1B26 | Dark glass base, dark sheets |
| night-700 | #2A2530 | Tiles and cells on dark cards |
| text-primary | #17141C | Main text on light surfaces |
| text-secondary | #4F4A56 | Subtext (about 7:1 on surface-card) |
| text-tertiary | #6B6570 | Meta, captions, helper lines (about 4.8:1 on surface-card, passes on every cream surface) |
| text-on-dark | #FFF6E0 | Text on night surfaces (warm cream, not pure white) |
| surface-sheet | #FBF8F2 | Bottom sheets, modal pages |
| surface-card | #F1ECE3 | Cards, grouped rows |
| surface-raised | #FFFFFF | Icon tiles, table cells, active segment |
| chip-off | #ECE6DC | Inactive chips, segmented track, neutral tags, stat bar tracks |
| divider | #D6CFC4 | Handles, unlit stars, upcoming progress steps |

### Action and status colors

| Token | Hex | Use |
| --- | --- | --- |
| taxi-400 | #FFC21A | Primary CTA (night-900 label), active nav tab, step progress, the clout flame and number, avatar rings |
| taxi-500 | #F2A900 | Pressed primary, rating stars, taxi text on light surfaces (with a night outline) |
| taxi-disabled | #FFC21A at 40% | Disabled primary |
| taxi-tint | #FFF3CC | Highlighted rows, the "Your pick" badge fill (night-900 text) |
| neon-500 | #FF2E88 | LIVE dots, glows, neon outlines, event accents |
| neon-600 | #E0186F | Count badges, notification pins, NEW and LIVE labels with white text (4.6:1) |
| neon-tint | #FFE3EF | Event and nightlife tag backgrounds (text #B0135A) |
| green-500 | #40B589 | Money in, confirm ("Move in"), the players-online dot |
| green-text | #2E8B63 | Positive money, success copy |
| green-tint | #DEF2E9 | Selected single-choice card (2 pt green-500 border), positive tags |
| red-500 | #D93A2F | Errors and destructive actions (sell, block, report); tint #FBE9E7, text #9E2A21 |

### Gold: real money only

| Token | Hex |
| --- | --- |
| gold-100 | #FEF3C0 |
| gold-300 | #E1BC85 |
| gold-500 | #AD8759 |
| gold-700 | #7E5932 |

Gold appears in exactly six places: the logo, the tagline bar, the premium-gold button, the 1 pt gold-300 stroke on real-cash item cards, the ✨ real-cash tag, and the exclusive-event card's price button. It never appears on clout, net worth, badges, rings, overlines or in-game-cash items.

### Gradients

| Name | Stops | Where |
| --- | --- | --- |
| gold-metal | #FEF3C0 0% → #E1BC85 35% → #AD8759 70% → #7E5932 100%, linear 180°, 1 px inner top highlight rgba(255,255,255,0.6) | Real-cash price buttons and the real-cash tag only |
| neon-banner | #FFC21A → #FF6A3D → #FF2E88, linear 90° | Special prompts, the home-screen story prompt |
| night-reveal | #14111A base + radial #FF2E88 at 30% top-right + radial #FFC21A at 20% bottom-left | Reveal cards, birth lottery result, exclusive events |
| night-stage | #1B1622 → #2E2236, linear 180° | Avatar creator backdrop |
| phone-wallpaper | #2B1A4A → #FF2E88 60% → #FFC21A 100%, linear 180° | Phone home screen |
| hazard | repeating-linear-gradient(45°, #FFC21A 0 8px, #14111A 8px 16px) | Locked boroughs, closures, "Coming soon," announcement bars: 6 pt band on edges only, never behind text |
| dice-tile | #FFF3CC → #FFC21A, linear 160° | Birth lottery dice tile |

### Glass

| Surface | Fill | Blur | Border | Seen on |
| --- | --- | --- | --- | --- |
| glass-dark (default in world) | rgba(20,17,26,0.62) | 20 px backdrop blur, saturate 1.4 | 1 px rgba(255,246,224,0.14) | HUD, side column, stats panel, map pins, nav bar, live ticker |
| glass-light | rgba(255,250,240,0.70) | 20 px | 1 px rgba(255,255,255,0.6) | Pills over bright interiors, tooltips, instruction cards |
| glass-solid | rgba(251,248,242,0.94) | 12 px | none | Toasts, loading pills |
| scrim | rgba(10,8,14,0.60) + 6 px blur on the game | n/a | n/a | Behind the phone modal, sheets and tutorial tooltips |

Provide a no-blur fallback (solid fills at 92% opacity) for low-end Android.

### 2D map colors

| Token | Hex | Use |
| --- | --- | --- |
| map-water | #0F0D14 | Rivers and bay |
| map-land | #1C1824 | Unlocked land (Queens) |
| map-street | #2A2530 | Street grid |
| map-road | #FFC21A at 55% | Major roads and highways |
| map-park | #1F2A24 | Parks |
| map-locked | #141118 at 80% | Locked boroughs, with a hazard edge |
| map-label | #FFF6E0 at 60% | Neighborhood names |

## 4. Typography

Three families: a chunky NYC-signage display face for names, titles and reveals; a condensed sans for loud labels and numbers; and a neutral UI sans for everything people read.

- **Display: Bungee** (Google Fonts, single weight). Sentence case for names, uppercase only for short reveals.
- **Labels and numbers: Barlow Condensed 600/700.** Uppercase overlines, HUD numbers, tags, tagline bars. Tabular figures for money and clout.
- **UI: Inter 400/500/600** (SF Pro on iOS is fine). Body, subtext, buttons and table text.

### Type scale

| Token | Family / weight | Size / line height | Color | Example |
| --- | --- | --- | --- | --- |
| display-xl | Bungee | 30 / 34 | text-on-dark | Birth lottery reveal, story reveal |
| display-lg | Bungee | 24 / 28 | text-primary | Sheet titles: "Shop," "Possessions," "Leaderboard" |
| display-md | Bungee | 20 / 24 | text-primary | Player name in profile, beat headlines |
| display-sm | Bungee | 16 / 20 | text-primary or text-on-dark | Creator step titles: "Look," "Traits," "Birth lottery," "Home" |
| title | Inter 600 | 16 / 22 | text-primary | Card titles |
| body-strong | Inter 600 | 15 / 20 | text-primary | Button labels, table values |
| body | Inter 400 | 15 / 21 | text-primary | Beat bodies, prompts, explanations |
| subtext | Inter 400 | 13 / 18 | text-secondary | Card descriptions |
| meta | Inter 500 | 12 / 16 | text-tertiary | "1×1," timestamps, "7 of 10 left today" |
| overline | Barlow Condensed 700 | 12 / 14, uppercase, tracking +10% | text-tertiary, or text-on-dark at 60% on dark | "PREVIOUSLY," "YOUR PICK," table column heads |
| label-chip | Inter 600 | 14 / 18 | night-900 or text-on-dark | Chips, tabs, segmented control |
| label-tag | Barlow Condensed 700 | 14 / 16, uppercase, tracking +4% | tag text color | "STARTING CASH $7,400," "LIMITED" |
| hud-number | Barlow Condensed 700, tabular | 18 / 20 | taxi-400 for clout; text-on-dark for bank balance | "1,250," "$6,000" |
| tagline | Barlow Condensed 700 | 18 / 20, uppercase, tracking +6% | gold-300 on a night bar | "TAP IN. BLOW UP" |

### Main text and subtext rules

1. Every list item, card and row is a pair: title (600, primary) directly above subtext (400, secondary), 2 to 4 pt gap.
2. Inline qualifiers drop to tertiary in the same line: "Studio walk-up in Astoria," where "in Astoria" is 400 tertiary.
3. Status words take color, not just weight: "Good" in green-text 600.
4. Subtext never exceeds 3 lines; truncate with an ellipsis on cards.
5. Proper nouns inside subtext go bold.
6. Money uses tabular figures; positive amounts use green-text.

## 5. Spacing, radius, elevation and layout

Everything sits on a 4 pt grid with 20 pt sheet margins, and corners get rounder as elements get smaller: pills are full capsules, cards are soft, sheets are very soft.

### Spacing

| Token | Value | Used for |
| --- | --- | --- |
| space-1 | 4 pt | Title-to-subtext gap, icon-to-label inside chips |
| space-2 | 8 pt | Gap between chips, tags, table cells; HUD internal gap |
| space-3 | 12 pt | Card internal gap, grid gutter, floating HUD/nav/side-column margins |
| space-4 | 16 pt | Card padding, gap between stacked cards |
| space-5 | 20 pt | Sheet side padding |
| space-6 | 24 pt | Between sections inside a sheet |
| space-8 | 32 pt | Above the sticky CTA, top of sheet below the handle |

### Corner radius

| Token | Value | Elements |
| --- | --- | --- |
| radius-pill | 999 | HUD, chips, tags, map labels, live ticker, close button, badges |
| radius-xs | 8 pt | Table value cells, stat bar tracks |
| radius-sm | 12 pt | Secondary dark buttons, price buttons, icon tiles |
| radius-md | 16 pt | Primary CTAs, segmented track |
| radius-lg | 20 pt | Item cards, selection cards, beat cards, reveal and evidence cards |
| radius-xl | 28 pt | Bottom sheet top corners, phone screen |
| radius-device | 44 pt | Phone modal outer bezel |

### Elevation

| Token | Shadow | Use |
| --- | --- | --- |
| elev-0 | none | Cards inside sheets (they separate by tint) |
| elev-1 | 0 1 2 rgba(16,24,40,0.06) | Active segment, icon tiles, table cells |
| elev-2 | 0 4 12 rgba(16,24,40,0.10) | Floating pills, HUD, side column, nav bar, map pins |
| elev-3 | 0 8 24 rgba(16,24,40,0.14) | Primary CTA (plus a colored glow: 0 6 16 of the button color at 30%) |
| elev-4 | 0 -8 32 rgba(0,0,0,0.18) | Bottom sheet, phone modal |

### Layout

- Portrait-only mobile frame, 390 pt reference width.
- Item grids are 2 columns with a 12 pt gutter; selection lists are 1 column.
- Sheets open to about 72% of viewport height with the world visible above; a 36 × 5 pt grab handle sits 8 pt from the top.
- CTAs stick to the bottom of sheets, with a 32 pt cream fade masking scrolled content above them.
- Minimum tap target: 44 × 44 pt, including HUD icons.

## 6. Components: home screen

The home screen has a persistent HUD on top, a fixed icon column on the right, a collapsible stats panel bottom-left and a floating nav bar, all in dark glass over the city.

### C1. HUD (top bar)

One floating glass-dark capsule, 12 pt below the browser bar, 12 pt side margins, 48 pt tall, elev-2. It never collapses.

| Position | Element | Spec | On tap |
| --- | --- | --- | --- |
| Left | Time | City-clock time, Inter 600 15 pt, text-on-dark. Time only, never a date or weekday | None |
| Left | Daily Tasks | Outline checkmark icon + "0/5" in hud-number, text-on-dark | Opens Tasks on the Daily tab |
| Left | Sound | 32 pt icon button: outline speaker, or speaker with slash when muted | Toggles mute |
| Right | Clout | Outline flame icon + number, both taxi-400, hud-number | Opens the leaderboard |
| Right | Net Worth | 32 pt icon button with an outline diamond in text-on-dark. No figure. An 8 pt neon-600 pin on first play and whenever net worth changes | Opens Possessions |
| Right | Bank balance | "$6,000" in hud-number, text-on-dark, tabular | Opens transaction history |

The left and right clusters are separated by flexible space; icon buttons sit on rgba(255,246,224,0.10) circles. Over bright interiors, the HUD switches to glass-light with night-900 text (clout stays taxi-500).

### C2. Invite and players-online pills

Below the HUD at the left, 12 pt apart:

- **Invite your Clique:** pill-glass (32 pt) with label-chip text and an 8 pt neon-600 pin on first play.
- **Players online:** pill-status (28 pt) with an 8 pt green-500 dot and "N people online" in meta, text-on-dark. Hidden below the configured threshold (starts at 1).

### C3. Side icon column (fixed)

A vertical glass-dark capsule on the right edge, 12 pt from the screen edge, vertically centered above the stats panel. Five 44 pt icon buttons, 22 pt outline icons in text-on-dark, 8 pt gap. It never collapses (like TikTok's column).

| Order | Icon | Opens | Badge |
| --- | --- | --- | --- |
| 1 | Checklist | Tasks/Goals | — |
| 2 | Champagne glass | Events | neon-600 dot when an event starts soon |
| 3 | Building | Places | — |
| 4 | Receipt | Bills | neon-600 dot when a bill is due |
| 5 | Person | Your Look (wardrobe) | — |

### C4. Stats panel (collapsible)

Bottom-left, above the nav, glass-dark, radius-lg, 12 pt padding, about 150 pt wide.

- Three rows: Energy, Mood, Confidence. Label in label-chip (text-on-dark), then a full-width 6 pt bar, radius-pill.
- Bar color by level: green-500 at 60% and above, taxi-400 from 30 to 59%, red-500 below 30%. Track: text-on-dark at 15%.
- A chevron in the top-right corner collapses it to a single row of three small bars. It is the only collapsible element on the home screen.

### C5. Bottom navigation bar

- Floating glass-dark bar, 12 pt side margins, 64 pt tall, radius 24 pt; it doesn't touch the screen edges.
- Four tabs: **Home** (house), **Map** (location pin), **Phone** (phone outline), **Shop** (storefront). 22 pt outline icons (1.75 pt stroke) with 11 pt 500 labels.
- Active tab: a taxi-400 rounded rectangle (radius 18 pt) filling the tab slot, with night-900 icon and label and a soft taxi glow. Inactive: text-on-dark at 60%.
- The Phone tab carries a neon-600 count badge for unread messages and new beats.

### C6. Home-screen story prompt

A notification-style card that floats under the HUD after the tutorial hand-off and whenever a new beat drops.

- neon-banner gradient fill, radius-lg, 12 pt padding, emoji tile left (🔍), chevron right, ✕ to dismiss.
- Title in title style, night-900: "Queens has a whodunit. Think you can crack it?" (first time) or the new beat's headline.
- Tapping opens the beat in the News app.

## 7. Components: building blocks

These components are reused across every screen; each lists its anatomy, size, color and states.

### C7. Pills

| Variant | Height | Padding | Fill | Text | Example |
| --- | --- | --- | --- | --- | --- |
| pill-glass | 32 pt | 6 / 12 pt | glass-dark (glass-light over bright interiors) | label-chip | "Invite your Clique" |
| pill-solid | 36 pt | 8 / 16 pt | glass-solid | body-strong | "Loading map… 90%" |
| pill-status | 28 pt | 4 / 10 pt | glass-dark | meta + 8 pt status dot | "● 12 people online," "7 of 10 left today" |
| pill-handle | 22 pt | 2 / 8 pt | night-900 at 85%, no stroke | text-on-dark 12 pt 600 | "@bigssg" |
| pill-close | 36 pt | 8 / 14 pt | rgba(230,230,238,0.85) | ✕ + "Close" 15 pt 500 | Phone modal close |

### C8. Buttons

| Variant | Height | Radius | Fill | Label | When |
| --- | --- | --- | --- | --- | --- |
| primary-taxi | 52 pt | 16 pt | taxi-400 + glow (0 6 16 #FFC21A at 35%) | night-900 17 pt 600, optional › | Main action: "Roll the dice," "Continue ›," "Let's go" |
| primary-green | 52 pt | 16 pt | green-500 | white 17 pt 600 | Committing money or a choice: "Move in," "Buy," "Attend" |
| premium-gold | 52 / 40 pt | 16 / 12 pt | gold-metal, 1 pt gold-700 stroke | night-900 600 tabular | Real-cash purchases only |
| primary-night | 48 pt | 12 pt | night-900 | text-on-dark 16 pt 600, leading icon | Secondary strong actions: "↗ Share," "👀 Open evidence" |
| price | 40 pt | 12 pt | night-900 | text-on-dark 16 pt 600 tabular | Virtual-cash prices: "$12," "$85" |
| secondary | 52 pt | 16 pt | white, 1 pt #E2DBD0 border (on dark: glass-dark, 1 pt cream 14%) | night-900 or text-on-dark 16 pt 600 | "Log in," "I installed it" |
| ghost | 44 pt | none | transparent | text-secondary 15 pt 500 | "Not now," "Skip tour (bold of you)" |
| destructive | 52 / 40 pt | 16 / 12 pt | red-500 | white 17 pt 600 | Sell, block, report, leave |
| icon-round | 36 pt | pill | white + elev-1 (on dark: glass-dark) | 18 pt glyph | Back ‹, shuffle ⤨, locate, search |
| disabled | same size | same | taxi at 40% or #ADDCCA (green) | night-900 at 50% / white 70% | "Continue" until the trait quota is met; chat send at 0 |

A primary and secondary can pair horizontally at a 3:1 width ratio ("Sign up free" + "Log in"). Press state: scale 0.97 and darken 6%. Destructive actions always open a confirmation sheet first.

### C9. Segmented toggle

- Track: 44 pt tall, chip-off fill, radius 14 pt, 4 pt inner padding.
- Active segment: white, radius 11 pt, elev-1, label 15 pt 600 text-primary; inactive labels 15 pt 600 text-secondary.
- Segments split the width equally (Tasks: "Daily / Goals"; News app: "Today / Archive").
- The active segment slides with a 200 ms ease-out spring.
- Binary variant (body type in the creator): two separate 40 pt pills, selected = night-900 with white text, unselected = chip-off.

### C10. Filter chips and style chips

- Horizontally scrolling row, 40 pt chips, 16 pt side padding, 8 pt gap, bleeding off the right edge to hint at scrolling.
- Selected: night-900 fill, white label. Unselected: chip-off fill, text-primary label.
- Map version: glass-dark chips with a leading emoji ("✨ All," "🍸 Events," "🍔 Food," "🏢 Places," "🛍 Shop") and a 36 pt round search button first.
- **Style chips (Look step):** the eight starting styles (Bodega Drip, Thrift Store Icon, Midtown Finance, Night Owl Goth, Pilates Princess, Startup Founder, Influencer Soft Glam, Arcade Nerd) in a scrolling row of 40 pt chips; selecting one dresses the avatar instantly.
- Option chips in the creator (hair: Short, Long, Braids, Top bun…) wrap to multiple rows, 34 pt tall.

### C11. Tags

radius-pill, 24 pt tall, 4 / 10 pt padding, label-tag text, 6 pt gap, wrapping. Positive: green-tint fill + green-text. Neutral: chip-off + text-primary. Negative: #FBE9E7 + #9E2A21. Event or nightlife: neon-tint + #B0135A. Real cash: gold-metal fill + night-900 with a ✨ prefix. On dark cards keep the same light fills for contrast.

### C12. Badges

- **Count badge:** neon-600 circle 18 pt, white 11 pt 700, 2 pt white ring, top-right of an icon.
- **Pin:** neon-600 dot 8 pt, for first-play pins and "something changed."
- **NEW / LIVE label:** neon-600 pill 16 pt tall, white 9 pt 700 uppercase.
- **Info badge:** taxi-tint pill 22 pt with night-900 12 pt 600 ("Your pick").
- **Achievement badges** ("Called It," "Lola's Favorite"): 40 pt night-900 circle with an emoji and a 2 pt taxi-400 ring. Never gold.

### C13. Bottom sheet

- surface-sheet fill, radius-xl top corners, elev-4, 36 × 5 pt handle (divider).
- Header: display-lg title left, contextual value right (body-strong), subtext below.
- Content scrolls under a sticky CTA. Drag down to dismiss; the HUD stays visible above.

### C14. Step progress bar

Centered under the creator step title: **4 segments** (Look, Traits, Birth lottery, Home), 24 × 5 pt each, 6 pt gap, radius-pill. Done and current = taxi-400; upcoming = divider. Pairs with a 36 pt round back button on the left and an optional shuffle button on the right (Look step only).

### C15. Tutorial tooltip

- The scrim dims everything except the target, which keeps a 4 pt taxi-400 outline ring.
- Card: glass-light, radius-lg, 16 pt padding, max width 300 pt, with an 8 pt pointer toward the target.
- Contents: overline step counter ("2 OF 5"), body copy, and a compact primary-taxi "Next" (40 pt). Tooltip 5 has no button and pulses its target instead.

### C16. Reason banner

Shown whenever a story changes a price or closes something.

- A pill-solid (36 pt) under the HUD, or inline at the top of a place or event sheet.
- Leading emoji, reason text in body-strong ("🚨 Closed: police activity"), optional meta on the right ("reopens tomorrow").
- Closures get a 6 pt hazard band on the left edge; price changes get a neon-tint fill instead ("📈 Visits +50%: fans are packing Sarah's booth").

### C17. Instruction card (PWA install)

- Glass-light card, radius-lg, 16 pt padding, ✕ top-right.
- Header: 40 pt illustrative tile + title 15 pt 600 + 2-line subtext.
- Numbered steps: number in 15 pt 600 taxi-500, step title 14 pt 600 with an inline glyph (⎋ share, ⊞ add), 12 pt secondary helper underneath, 12 pt between steps.
- Footer: secondary "I installed it" + ghost "Not now," 1:1 width.

### C18. Color swatches and text field

- **Swatches:** 40 pt circles, 10 pt gap, horizontally scrolling rows per category (skin, hair, eyes) with a 13 pt 600 secondary label above each. Selected = 2 pt night-900 ring with a 2 pt white gap.
- **Text field:** 48 pt, chip-off fill, radius 14 pt, value in body-strong, hint right-aligned in tertiary ("your name in the city").

## 8. Components: the 2D map

P1 uses a flat, stylized night map of Queens, generated from street geometry and drawn in the map colors from section 3; a 3D map replaces it later through the same map interface.

### C19. Base map

- Night palette: dark land, darker water, a dim street grid, taxi-yellow major roads, muted parks, neighborhood labels at 60% cream. During city-clock daytime, a light overlay lifts the whole map (section 14).
- Queens is drawn in full. Other boroughs are dark silhouettes with a 6 pt hazard edge and a centered pill: 🔒 + borough name + "Coming soon" in meta.
- Base layers are pre-rendered as images at a few zoom levels; only pins and overlays are drawn live, so the map stays smooth on low-end phones.
- Detail fades with zoom: the street grid hides when zoomed out, and pins cluster. When zoomed in, generic 2D cars, buses and an elevated train loop along roads and rail lines (headlights at night; at most about 30 on screen; paused when the tab is hidden; off under reduced motion; no transit-agency logos). They're decorative and sit beneath the pins.
- Landmark labels use real names only when they aren't trademarked; businesses are invented.

### C20. Map location pin

- glass-dark pill, 26 pt tall, with a 20 pt emoji tile on the left and the name in Inter 600 12 pt, text-on-dark, max width 180 pt with an ellipsis.
- A 2 pt stem and 6 pt cream dot anchor it to the spot. elev-2.
- The emoji tile's color matches its filter chip (🍔 food, 🍸 nightlife, 🌳 parks, 🏢 places). A dining place's sheet shows its tier as a tag (Budget, Medium, Luxury) and the Energy a meal restores ("⚡ +20 Energy"), next to its price. A job place's sheet shows a primary-green "Work a shift" button with the pay and Energy cost in meta ("+$120 · ⚡ −25"), disabled at zero Energy.
- Event pins pulse with a neon-500 glow while an event is live; story places carry a small neon-600 dot during an active beat.
- Closed places show their pin at 50% with a 🚨 tile.
- Clusters: a 32 pt night-900 circle with a count in hud-number and a taxi-400 ring.

### C21. Player marker and locate button

- The player's own marker: a 28 pt avatar head in a taxi-400 ring with a soft pulse.
- Locate button: icon-round (glass-dark), bottom-right above the nav, which recenters on the player.

### C22. Live update ticker

- Full-width glass-dark pill, 32 pt, 8 pt above the nav.
- Leads with a LIVE badge (neon-600, pulsing neon-500 glow, white 10 pt 700 uppercase, 18 pt tall), then "📍 @user checked into…" in 12 pt 500 with an ellipsis, and the timestamp in meta at the right.
- Rotates every 4 seconds with a vertical slide.

## 9. Components: Shop, Possessions, events and leaderboard

These are the screens where players spend, own and compare; real-cash items are always visually separate from virtual-cash ones.

### C23. Item card (Shop listings)

- 2-column grid, surface-card fill, radius-lg, 16 pt padding.
- 52 pt white icon tile (radius-sm, elev-1) top-left; footprint or category meta top-right.
- Title in title style, a 2-line witty subtext ("Rent this luxury sedan. Might be fake life, but it's oh so worth it when you pull up to the club."), and a 4-star rating row (12 pt stars, taxi-500 on, divider off).
- Full-width **price** button (virtual cash) at the bottom.
- **Real-cash collector item:** 1 pt gold-300 card stroke, a ✨ real-cash tag, and a **premium-gold** price button. Mixed into normal listings with no banner or promotion, so players discover them while browsing.
- **Story item** (e.g. "Forever Our Bird" hoodie): a neon "LIMITED" tag and the reason banner style for its availability window.
- **Owned:** the price button becomes a chip-off "Owned" label.

### C24. Selection card (single and multi select)

| State | Fill | Border | Text | Extras |
| --- | --- | --- | --- | --- |
| Default | surface-card | none | primary + secondary | — |
| Selected (single, e.g. Home) | green-tint | 2 pt green-500 | unchanged | "Your pick" info badge top-right |
| Selected (multi, e.g. Traits) | night-900 | none | white title, white 70% subtext | 22 pt green check circle top-right |
| Dimmed (quota reached) | surface-card | none | all text at 35% | not tappable |
| Disabled (can't afford) | surface-card | none | text at 50%, price in red-500 | meta: "Leaves too little for this week" |

The Traits header swaps its helper from "Pick 2 more." (tertiary) to "Locked in. Very on-brand." (green-text 600) when the quota is met.

### C25. Possessions sheet

Opened from the diamond in the HUD.

- Header: display-lg "Possessions" with the net worth total on the right (body-strong, tabular).
- First row: 💵 Bank cash and its amount.
- Then items grouped by Shop category (overline headers), each row: 40 pt icon tile, title, value on the right in tabular figures, and a meta line for how it was acquired ("Bought," "Earned," "✨ Collector").
- Tapping a row opens a detail sheet with a **destructive** "Sell for $X" button (60% of value) and a confirmation sheet: "Sell your \[item\] for $X? Net worth drops by $Y."
- Collector and starter items show "Can't be sold" in meta instead of a sell button.

### C26. Event cards

| Type | Card | Action button |
| --- | --- | --- |
| Club event | Item card style, neon-tint 🍸 tag | **price** button (virtual cash) |
| Free story event | Item card style, neon-tint tag "STORY" | **primary-green** "Attend" |
| Exclusive event | night-reveal gradient card with a neon glow, ✨ real-cash tag | **premium-gold** button |

- **Countdown:** before doors open, the action button is disabled and a meta line shows real minutes: "Doors open in 25 min."
- The first-task party is always "Happening now" with "Bring the clique" (primary-taxi) and "Pull up solo" (secondary).
- A cancelled event shows the reason banner and no button.

### C27. Leaderboard (comparison table)

- Container: surface-card, radius-lg, 16 pt padding.
- Header: overline label ("QUEENS LEADERBOARD") and the player's rank in display-md ("You're #4,212").
- Rows: rank in meta, 32 pt avatar, name in title style, clout on the right in hud-number (taxi-500 on light). The player's own row is highlighted in taxi-tint.
- A segmented toggle switches between "Queens" and "Clique."
- Footnote in subtext explaining how clout is earned.

### C28. Profile header

56 pt circular avatar with a 3 pt taxi-400 ring, display-md name, then a meta row: mood emoji + status word (green-text) · style emoji + starting style in secondary ("🙂 Good · 🥯 Bodega Drip").

## 10. Components: Phone, News app, Story mode and chat

The Phone holds the News app (stories) and Messages (chat); Story mode adds five card types so beats, guesses, evidence and paid side arcs each have a clear look.

### C29. Phone modal

- Opens over the game with the scrim; the game stays visible but darkened.
- Device frame modeled on an iPhone: 10 pt black bezel, radius-device, a 90 × 26 pt camera pill, status bar (city-clock time, signal, battery).
- Home screen: phone-wallpaper gradient, large clock (Inter 700 56 pt) with a "Queens" city line, and a 4-column grid of 56 pt app icons (radius 14 pt) with 11 pt labels and NEW badges.
- P1 apps: **News** (stories), **Messages** (chat), **Bank** (transaction history), **Gigs** (today's offers and the active gig), **Settings** (music and account).
- In-app screens use the light sheet styles with a ‹ back chevron and a display-lg title.
- pill-close sits top-right outside the device frame.

### C30. Beat card (News app feed)

- surface-card, radius-lg, 16 pt padding, full width.
- Top row: story name in overline + "Day 3 of 10" in meta; a NEW label on unread beats.
- "Previously" line: overline "PREVIOUSLY" + one line of subtext in italics.
- Headline in display-md, body in body (2 to 3 sentences), and the hook as the last line in title style.
- Footer: a primary-night "↗ Share" button and, where a beat has a prediction or evidence, its card directly below.
- Lola Lowdown's byline: a 24 pt avatar + "Lola Lowdown" in meta.
- The News app has a segmented toggle: "Today / Archive." **Today** lists every released beat of the live arc in order, newest on top with unread NEW labels, so late joiners can scroll back and catch up. **Archive** lists finished arcs; each opens as its beats in order, with predictions in their closed state showing final results, and the reveal card kept behind its own beat. Before the reveal beat, a primary-night "Make a shadow guess" button lets late readers pick an answer for a badge (no clout).

### C31. Prediction card

- surface-card with a 2 pt neon-500 border while open; radius-lg.
- Overline "CALL IT" + close time in meta ("Closes tonight").
- Question in title style; options as 48 pt single-select rows (selection card, single).
- After voting: each option shows a horizontal result bar (taxi-400 for the player's pick, chip-off for others) with the percentage in tabular body-strong. "Change vote" in ghost style until close.
- Closed: border turns divider, meta reads "Voting closed. Reveal on Day 9."

### C32. Reveal card

- night-reveal gradient, radius-lg, 20 pt padding, text-on-dark.
- Overline "THE TRUTH" + answer in display-xl.
- The player's own pick with a check or cross, and Lola's one-line roast in body.
- Rewards row: "+200 clout" in taxi-400 hud-number and any earned achievement badge (C12).

### C33. Evidence card

- surface-raised, radius-lg, with a 1 pt divider border and a slight paper texture.
- Overline "EVIDENCE" + item title; content is an image, a screenshot-style story post, a log page or a document excerpt.
- Opening it completes evidence story tasks.

### C34. Side-arc teaser (locked)

- surface-card with a 1 pt gold-300 stroke (real cash).
- Title in title style, hook line in subtext, ✨ real-cash tag.
- Released beats listed as locked rows: 🔒 + headline only, in tertiary.
- premium-gold button: "Unlock for $2.99."
- Unlocked: the stroke disappears and the rows become normal beat cards.

### C35. Messages (chat)

- Conversation list: 48 pt avatars, name in title, last message in subtext, time in meta, neon-600 unread count.
- Thread: bubbles with radius 18 pt; own messages in night-900 with text-on-dark, others in surface-card with text-primary.
- Composer: 48 pt text field + send icon-round. A pill-status above it shows "7 of 10 left today"; at 0 the send button is disabled and the field reads "Back tomorrow."
- ⋯ menu on each thread: **Block** and **Report** (destructive), each confirmed in a sheet. Long-pressing a message also offers Report.
- Report sheet: reason chips ("Harassment," "Spam," "Inappropriate," "Other"), optional note, destructive "Send report." Confirmation toast: "Thanks. Our team will review it."
- Blocked: the thread hides immediately and the list shows a small "Blocked" meta on the contact.

### C36. Gig card (Gigs app)

- surface-card, radius-lg, 16 pt padding. A tier tag top-left: "SIDE GIG" (neutral), "PRO GIG" (taxi-tint) or "BIG BREAK" (neon-tint).
- Client and title in title style ("Run a launch campaign for a $14 artisanal ice cube startup"), one witty subtext line, and a meta row: pay in green-text tabular, Energy cost (⚡ −40) and wait time (⏱ 2 h).
- Action: primary-green "Take the gig." Disabled with a reason in meta when the player can't accept: "Needs Confidence 50 (you have 38)," "Not enough Energy" or "Finish your current gig first."
- Gigs the player doesn't qualify for stay visible at 60% opacity with a 🔒 and the Confidence needed, as a goal to work toward.
- **Active gig:** the card pins to the top with a progress bar (taxi-400) and a countdown in real time; when it ends, a primary-green "Collect $X" button pays out. The Phone tab badge shows when a payout is ready.
- An expiry line in meta on every offer: "Expires at midnight."
- Never gold: gigs are virtual cash only.

### C37. Location card

- Opens as a bottom sheet (C13) when a pin is tapped.
- Top: an original 16:9 illustration of the location (radius-lg; no real signage or brand names), a category tag, and the reason banner (C16) if a story is affecting it.
- Title in display-lg, neighborhood in meta, then 2 to 3 lines of lore in body, in Lola Lowdown's voice.
- Actions: one row per action, with the action name in title style and its effects as meta chips: price (tabular), ⚡ Energy, 🔥 clout (taxi-500), 🙂 Mood, 💪 Confidence. Each row has its own button: primary-green when the action spends cash, primary-taxi otherwise.
- Unavailable actions stay visible, disabled, with the reason in meta: "Clout again tomorrow," "Not enough Energy," "Closed: police activity."
- Full locations add a primary-taxi "Go inside" button that opens the interior (C38). Map-flavor locations show only the illustration and lore.

### C38. Interior scene

- A full-screen illustrated 2.5D backdrop from one of 8 templates (apartment, counter shop, diner or café, fine dining, club, store, office, campus), recolored per location with its own sign and props.
- The 3D avatar stands on a marked spot in the scene with its idle animation; a night lighting variant applies when the city clock is at night.
- The location's actions sit in a bottom sheet; the HUD stays visible, and a back button returns to the map.
- Template slots are designed so fully 3D rooms can replace the backdrops later without changing the actions or data.

### C39. Postcard and Collection

- **Postcard:** a 3:2 original illustration of the monument in a vintage postcard frame, with "Greetings from Queens" in the tagline style. Owned postcards carry the 1 pt gold-300 real-money stroke.
- **Offer on the monument card:** shown once, right after a visit: a row under the actions with a locked postcard thumbnail, "Collect the postcard," and a premium-gold "$0.99" button. The visit's clout is shown separately, so it's clear the clout comes from visiting.
- **Collection screen:** opened from the profile (C28) and from a link at the foot of the Possessions sheet. A 2-column grid: owned postcards in full color with a share button; visited but not owned as locked silhouettes with their price and a premium-gold button; unvisited as outlined cards reading "Visit to unlock."
- Completing the set awards an achievement badge (C12).

## 11. Iconography, emoji and 3D characters

Three visual languages, on purpose: thin outline icons for navigation, native emoji for personality, and soft 3D renders for characters.

### Icons and emoji

| Layer | Style | Size | Where |
| --- | --- | --- | --- |
| System icons | Outline, 1.75 pt stroke, rounded caps (Lucide or SF Symbols) | 20 to 22 pt | HUD, side column, nav bar, back, share, search, close, locate |
| Emoji | Native emoji, never recolored | 14 to 18 pt inline, 24 to 28 pt in tiles | Chip prefixes, traits, map tiles, reason banners, prompts |
| Icon tiles | Emoji or a 3D object centered on a white (or night-700 on dark) squircle | 40 to 56 pt, radius 12 to 14 pt | Shop items, reveal cards, banners, the PWA card |
| App icons | Colorful squircles with gradient fills | 56 pt | Phone home screen |

**Rules:** one emoji per label at most; emoji lead, never trail; system icons stay monochrome.

**Fixed icon choices:** clout = flame; net worth = diamond; Daily Tasks = checkmark; sound = speaker or speaker with slash; Tasks/Goals = checklist (a trophy would imply the leaderboard); Events = champagne glass; Places = building (the pin belongs to Map); Bills = receipt; Your Look = person.

### 3D characters

- **Avatar style:** chibi proportions (head about 40% of height), smooth matte materials, oversized glossy eyes with a white catchlight, blush on cheeks, chunky hair meshes, simple clothing with one accent detail.
- **Lighting:** soft key light from the top-left, warm fill, gentle ambient occlusion; no hard outlines.
- **Stage:** the character stands on a dark elliptical pedestal (about 260 × 40 pt) with a low-intensity neon-500 rim light and a soft taxi-yellow spotlight from above, against the night-stage gradient with faint city-light bokeh. Idle animation: breathing, blinking, an occasional head turn.
- **Customization:** every Look choice and starting style renders on the avatar instantly. Hair, braids, wigs, glasses and cultural or religious coverings are free options for every style.
- **Implementation path:** three.js with GLTF character meshes from a modular base, MeshStandardMaterial with low roughness on eyes, HemisphereLight + DirectionalLight with soft shadows. Keep mobile frame rates above 50 fps.

### Map

P1 uses the 2D night map (section 8). The later 3D map (dusk or night city, desaturated with warm streetlights, so glass pills pop) plugs into the same map interface.

## 12. Patterns, flows and voice

Onboarding keeps the avatar on stage at the top while a sheet below changes per step; every step ends in one loud button. Full step order and copy live in Clarifications section 1.

### Character creation (four steps)

1. **Look:** name field, body toggle (binary pills), style chip row (eight starting styles), hair option chips, color swatch rows, glasses and covering options. A shuffle button top-right randomizes.
2. **Traits:** 2-column multi-select cards, quota of 2; "Continue" disabled until met; the header copy flips to a success line. Traits are flavor only in P1.
3. **Birth lottery:** rolled once per account (a 🔒 caption explains it), a big dice tile, a "Roll the dice" primary-taxi button, then a reveal card with the starting cash ($6,000 to $10,000) in display-xl.
4. **Home:** single-select list cards of Queens apartments with rent lines; homes the player can't afford are disabled; primary-green "Move in" commits.

After "Move in": the welcome modal, five tutorial tooltips (C15), the first-task party (C26), the leaderboard (C27), the invite prompt, the PWA card (C17), and the home-screen story prompt (C6).

### Interaction patterns

- **Sheet over world:** tapping Shop, a place, an event, Possessions or the profile opens a bottom sheet; the HUD stays live above it.
- **Modal device:** the Phone opens as a framed device over the dimmed world, closed by the pill button.
- **Contextual prompts:** dismissible cards (story prompt, PWA install) float under the HUD with a small ✕.
- **Selection feedback:** selected state changes fill and adds a check or badge; helper copy confirms with a joke.
- **Locked and disabled:** disabled buttons keep their color at reduced opacity rather than turning grey, so the next action is still obvious.
- **Explained changes:** any story-driven closure or price change shows the reason banner (C16).
- **Destructive actions:** sell, block and report always confirm in a sheet first.
- **Real money is always marked:** gold stroke, ✨ tag and premium-gold button, every time.

### Voice

Short, funny, specific microcopy everywhere ("Rent is due Saturday," "Doors open in 25 min," "Locked in. Very on-brand."). Copy is part of the delight. No real brand names; satire targets behavior, never groups.

## 13. Motion

Motion is quick and springy, and it respects the system's reduced-motion setting (fades replace slides and scales).

| Interaction | Duration | Easing |
| --- | --- | --- |
| Sheet open / close | 320 ms / 240 ms | spring (damping 0.85) / ease-in |
| Segmented slider, chip select | 200 ms | ease-out |
| Card select (fill + check pop) | 180 ms, check scales 0.6 → 1 | back-out |
| Button press | 100 ms, scale 0.97 | ease-out |
| Phone modal | 300 ms, scale 0.92 → 1 + fade | spring |
| Live ticker rotate | 250 ms slide every 4 s | ease-in-out |
| Dice roll | 900 ms tumble, then the reveal card rises 24 pt + fade | custom |
| Stat bar change | 400 ms width tween, color crossfade | ease-out |
| Tutorial tooltip | 200 ms fade + 8 pt rise; target ring pulses every 1.5 s on tooltip 5 | ease-out |
| Prediction results | 500 ms bar growth after voting | ease-out |
| Reveal card | 400 ms rise + fade, then badge pop (scale 0.6 → 1) | back-out |
| Map pin pulse (live event) | 1.6 s loop | ease-in-out |
| Day / night map transition | 2 s crossfade as the city clock passes dusk and dawn | linear |

## 14. Starter tokens (CSS)

Ship this token file with all three fonts (Bungee, Barlow Condensed, Inter) and tabular figures enabled.

```css
:root {
  /* night + text */
  --night-900:#14111A; --night-800:#1F1B26; --night-700:#2A2530;
  --text-1:#17141C; --text-2:#4F4A56; --text-3:#6B6570; --text-on-dark:#FFF6E0;

  /* surfaces */
  --surface-sheet:#FBF8F2; --surface-card:#F1ECE3; --surface-raised:#FFFFFF;
  --chip-off:#ECE6DC; --divider:#D6CFC4;

  /* action + status */
  --taxi-400:#FFC21A; --taxi-500:#F2A900; --taxi-tint:#FFF3CC;
  --neon-500:#FF2E88; --neon-600:#E0186F; --neon-tint:#FFE3EF; --neon-text:#B0135A;
  --green-500:#40B589; --green-text:#2E8B63; --green-tint:#DEF2E9;
  --red-500:#D93A2F; --red-tint:#FBE9E7; --red-text:#9E2A21;

  /* gold: real-cash products only */
  --gold-100:#FEF3C0; --gold-300:#E1BC85; --gold-500:#AD8759; --gold-700:#7E5932;

  /* gradients */
  --g-gold:linear-gradient(180deg,#FEF3C0 0%,#E1BC85 35%,#AD8759 70%,#7E5932 100%);
  --g-neon:linear-gradient(90deg,#FFC21A,#FF6A3D,#FF2E88);
  --g-stage:linear-gradient(180deg,#1B1622,#2E2236);
  --g-hazard:repeating-linear-gradient(45deg,#FFC21A 0 8px,#14111A 8px 16px);

  /* glass */
  --glass-dark:rgba(20,17,26,.62); --glass-light:rgba(255,250,240,.70);
  --glass-solid:rgba(251,248,242,.94); --scrim:rgba(10,8,14,.60); --blur:20px;

  /* 2D map (night); day = night palette + --map-day-overlay */
  --map-water:#0F0D14; --map-land:#1C1824; --map-street:#2A2530;
  --map-road:rgba(255,194,26,.55); --map-park:#1F2A24;
  --map-locked:rgba(20,17,24,.80); --map-label:rgba(255,246,224,.60);
  --map-day-overlay:rgba(255,246,224,.18);

  /* shape + type */
  --r-pill:999px; --r-xs:8px; --r-sm:12px; --r-md:16px; --r-lg:20px; --r-xl:28px;
  --font-display:'Bungee',Impact,sans-serif;
  --font-label:'Barlow Condensed','Arial Narrow',sans-serif;
  --font-ui:'Inter',system-ui,sans-serif;
}
```

Daytime on the city clock lifts the night map with `--map-day-overlay`; everything else (pins, glass, labels) stays the same.

## 15. Clout City features mapped to components

Every P1 feature in Clarifications & Updates (v2) maps to the components above.

| Feature | Component(s) | Notes |
| --- | --- | --- |
| Guest map and sign-up | C19 base map, C13 sheet | First tap on anything interactive opens sign-up (email or Google, with an 18+ confirmation checkbox) and starts music |
| Character creation | C10 style chips, C18 swatches and text field, C9 binary toggle, C24 selection cards, C14 progress bar, C8 buttons | Four steps; night-stage behind the avatar |
| Birth lottery | Dice tile, C32-style reveal card (night-reveal) | Shows starting cash in display-xl |
| Tutorial | C15 tooltip | One at a time, "2 of 5" counter |
| HUD | C1 | Clout in taxi-400; net worth icon only |
| Clout Score → leaderboard | C27 | Opens from the flame |
| Net Worth → Possessions | C25 | Selling at 60%, with confirmation |
| Bank balance → transactions | C13 sheet with rows | Also the Bank app in the Phone |
| Daily Tasks and Goals | C9 "Daily / Goals," C24 multi-select cards | Done = night card with green check; bonus = reveal card |
| Side icons | C3 | Fixed; badges for events and bills |
| Stats panel | C4 | Only collapsible element |
| Shop | C10 category chips, C23 item cards | Collector items unpromoted, marked with gold |
| Bills | C13 sheet, C24 rows | Due bills get a neon-600 dot |
| Map, places and cooldowns | C19 to C21, C13 place sheet | Cooldown shown as meta: "Clout again tomorrow" |
| Locked boroughs | C19 | Hazard edge + 🔒 pill |
| Events (three types) | C26 | Countdown in real minutes |
| Story price changes and closures | C16 | Hazard band for closures, neon tint for prices |
| Invite flow | C2 pill, C13 sheet with progress bar | Five-friend bonus bar uses taxi-400 |
| Players online | C2 | Hidden below the threshold |
| Live activity | C22 | "@user hit 10k clout in Astoria" |
| News app and stories | C29, C30 to C34 | Story prompt C6 on the home screen |
| Chat | C35 | 10 a day, block and report |
| Music | C1 sound button, Settings app | Remembered mute |
| PWA prompt | C17 | Android and iOS variants |

## 16. Build checklist

Work through these in order; the first three set up everything the components depend on.

- [ ] Ship the token file (section 14) and all three fonts with tabular figures enabled.
- [ ] Build glass-dark, glass-light, glass-solid and scrim utilities, with the no-blur fallback for low-end Android.
- [ ] Lock the 2D night map's look: approve one static styled screenshot of Queens before building pins and gestures.
- [ ] Build components C1 to C39 as isolated, stateful pieces (default, selected, disabled, pressed, and closed or locked where relevant).
- [ ] Replace the old HUD, nav and any reference-era layout with C1 to C5.
- [ ] Build the four-step creator and fix customization rendering so every choice updates the avatar instantly.
- [ ] Upgrade avatars to the 3D character spec (section 11).
- [ ] Build the Story mode cards (C30 to C34) and chat (C35) against the World State Layer Brief (v2).
- [ ] Write witty microcopy for every card subtext and helper line; no real brand names.
- [ ] Audit gold: it must appear only on real-cash products, the logo and the tagline.
- [ ] Audit contrast: body and subtext pass 4.5:1 on every cream surface; white text sits on neon-600, never neon-500.
- [ ] Check every screen at 390 pt and on a low-end Android device.
