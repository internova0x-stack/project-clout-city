# Clout City: World State Layer Brief (v2)

Oct 11, 2026 · @Internovatechnologies

## 1. Context

The World State layer is a minimal, day-one part of the P1 architecture: every story beat writes to it, and every game system reads from it. It ships before public launch and is extended later, never reworked.

Clout City is an NYC Sims-style life game. Core mechanics: daily tasks, long-term goals, clout and net worth, boroughs unlocked over time (Queens first), places to visit, events to attend, possessions, the News app, chat and friends, and story arcs.

Stories are the main retention driver. Players should want to know how things end, and the world should react: NPCs gossip, events get cancelled, places close for police activity, visit prices rise as fans pile in.

**The first story is "Who Killed Sarah Bird?"** (see the Sarah Bird v2 brief): a 10-beat Queens mystery anchored in Long Island City and Astoria, with three predictions and three premium side arcs. It is the layer's first real content and its acceptance test. The layer must support every future arc too, so the schema is not shaped around this one story.

**First step:** inspect the codebase you are building in (the new P1 repo, plus any modules ported on purpose from the old build) and adapt this brief to it. The stack is Next.js, Supabase, Stripe and Vercel (Game Concept Note). Report where each system will integrate before building.

**Related documents:** Clarifications & Updates (game rules and P1 scope), Story Production and Payments Brief (pipeline and Stripe), Story Quality Brief (content rules), Design System Guide (UI components).

## 2. Core idea and design principles

One shared source of truth: story beats write effects to it, and every game system asks it what applies.

- Stories never contain system-specific code. A beat declares effects; systems query the world state.
- Adding a new arc is a content-only change (a data file), never a code change.

**Principles**

1. **Data-driven.** Arcs, beats, predictions, effects, chatter and story tasks live in data files.
2. **Derived, not mutated.** Global world state is a pure function of (arc definitions, world clock). No cron jobs, no manual flipping. Pausing an arc is a data edit (`status`), not a state change. Only per-player progress is stored.
3. **Tag-based targeting.** Places, events, shop items, tasks and NPC types all carry tags (e.g. `skyline_pier`, `radiant_harbor`, `cafe`, `club`, `fashion`). Effects target tags, optionally scoped to a borough.
4. **Expiring effects.** Every effect ends, by explicit expiry or by a later beat. Nothing lasts forever by accident.
5. **Fail-safe defaults.** If anything is missing or unmatched, the game behaves exactly as it would without the world state.
6. **Progression-safe.** Effects never block protected systems (section 7). Closures are for flavor and optional content.
7. **Explainable.** Any changed price or closure returns short reason text, shown in the reason banner component from the Design Guide ("Closed: police activity").
8. **Clout comes from base values.** Price effects change what a player pays, never the clout a visit or event awards.

## 3. Data model

Four content objects (arc, beat, prediction, effect), plus computed world state and stored player state.

### Arc

| Field | Notes |
| --- | --- |
| `id`, `title` | e.g. `sarah-bird` |
| `type` | `main` or `side` (mini arcs are `main` with 3 to 4 beats) |
| `parent_arc_id` | Side arcs only |
| `tier` | `free` or `premium` |
| `sku` | Premium only; matches the Stripe Price in config |
| `status` | `active`, `paused` or `retired`. Paused and retired arcs are treated as absent |
| `start_at` | Date of Day 1 on the New York calendar |
| `start_weekday` | Optional constraint checked by validation (Sarah Bird: `sunday`) |
| `borough_scope` | Optional; effects outside unlocked boroughs are skipped for that player |
| `teaser` | Side arcs: title plus one hook line, shown to players without the entitlement |
| `answer_key` | Server-only; never sent to any client before the reveal beat |
| `beats[]` | Ordered list |

### Beat

| Field | Notes |
| --- | --- |
| `id`, `day` | `day` is 1-based: Day 1 = `start_at` |
| `status` | `active`, `paused` or `retired` |
| `visible_at`, `effective_at` | When it appears in the News app and when its effects apply. Both default to the start of its day; kept separate for a later insider pass |
| `news[]` | `headline`, `body`, `previously` (one-line recap for latecomers) |
| `effects[]` | See effect types below |
| `story_tasks[]` | Task ids injected with this beat |
| `prediction` | Optional (below) |
| `requires` | Optional conditions: borough unlocked, flags |

### Prediction (P1)

| Field | Notes |
| --- | --- |
| `id`, `question`, `options[]` | e.g. P2: "Who killed Sarah Bird?" |
| `closes_at` | Must be before any beat that points at the answer. Validation checks it is before the next beat's `visible_at` when that beat is flagged `points_at_answer` |
| `reveal_beat` | The beat id that reveals the answer |
| `correct` | Server-only until the reveal |
| `reward` | Clout, optional badge (e.g. "Called It") |
| `changeable` | Votes can change until close (default true) |

Live results (percentages per option) are shown to a player after they vote.

### Effect types

| Type | Purpose | Sarah Bird example |
| --- | --- | --- |
| `price_multiplier` | Changes a price by tag, optional borough; `applies_to`: `visit_price`, `event_entry` or `shop_price` | Rockaway Diner visits ×1.5, Days 3 to 6 |
| `availability` | Close, restrict, cancel or open entities by tag, with reason text | Skyline Pier lobby only; hoodie opens in the Shop |
| `chatter_topic` | Activates a gossip topic and phase, with a priority | `sarah-bird`, phase `early` |
| `task_injection` | Adds or removes story tasks, or story gigs (which follow the gig rules in Clarifications section 13) | `story:sarah-bird:leave-flowers` |
| `place_state` | Changes how a place appears or spawns a place or event (club, exclusive or free story event) | Vigil at Hunter's Pier; memorial wall |
| `flag` | Sets a world flag usable in `requires` | `sarah-bird-solved` |
| `reward_modifier` | Adjusts clout for tagged tasks; never applies to purchases or side arcs | — |

### State

**World state (computed):** current world time, active arcs, active effects, flags, open and closed predictions.

**Player state (stored):** beats seen, story tasks done, votes, shadow guesses, badges earned, entitlements (by `sku`).

## 4. Query API and resolution rules

Systems only call these functions; they never reference arcs directly.

| Function | Returns |
| --- | --- |
| `getModifiers(target: {tags, borough})` | Resolved effects after stacking rules |
| `isAvailable(entity)` | `{available, reason}` |
| `getPrice(basePrice, entity, kind)` | Final price plus reason text if changed. `kind` = `visit_price`, `event_entry` or `shop_price` |
| `getClout(baseValue, entity)` | Clout reward from the base value; ignores price multipliers |
| `getChatter(npcType, context)` | One line, chosen by active topics, phase and priority, with a generic fallback |
| `getStoryTasks(player)` | Story tasks currently offered to this player |
| `getNewsFeed(player)` | Visible beats for this player, respecting entitlements and `status` |
| `getPredictions(player)` | Open, closed and revealed predictions, with the player's vote and live results after voting |
| `hasEntitlement(player, sku)` | Single gate for all premium content: side arcs, exclusive events, collector fashion and monument postcards |

**Stacking rules**

- Price multipliers take the single highest value, capped at 2×.
- Closures override everything else.
- At most 2 chatter topics are active at once, chosen by priority.
- Effects on protected systems are ignored (section 7).
- Paused or retired arcs and beats contribute nothing.

## 5. Story timing

One story day equals one real calendar day on a server-authoritative New York clock, so every player sees the same beat on the same day.

- **World clock:** America/New\_York, server-authoritative. P1 has a backend (Stripe webhooks need one), so the device clock is never trusted.
- **Cadence:** main arcs run 6 to 10 beats, usually one per day, with the biggest cliffhanger before the reveal. Never two finales on the same day.
- **Start day:** an arc can require a weekday (`start_weekday`). Sarah Bird starts on a Sunday so its weekday references stay correct; stories never use calendar dates in their copy.
- **Late joiners** land on the current beat with its "Previously" line, and can read every released beat of the live arc in order. They can vote in any prediction that's still open; story tasks from past days are gone.
- **Archive:** finished arcs move to the archive in the News app. They read in order; each prediction shows its final poll results; the reveal stays behind its own beat so the list never spoils it; and before opening the reveal, a reader can make a "shadow guess" that earns a badge but no clout. Side arcs stay purchasable from the archive.
- **Pilot start:** the pilot's `start_at` is set manually when the player base is ready, not tied to launch day.
- **New players** see the current story right after the tutorial hand-off, via the home-screen prompt.
- **Pause / retire:** setting `status` on an arc or beat hides it immediately, with no code deploy.

**Required dev tools**

- A time-travel control that sets the world clock in staging.
- A debug panel listing active arcs, beats, effects, flags and prediction windows.

These are needed for the dry run of every arc in the Payments Brief pipeline. Testing a 10-day arc without them is impractical.

## 6. NPC chatter

NPCs gossip differently as a story moves through four phases: early, mid, late and post.

- Each NPC type (bartender, barista, doorman, rideshare driver, and so on) has 2 to 3 line variants per topic per phase.
- Lines live in data, keyed by topic and phase. Phases are switched by `chatter_topic` effects on beats (Sarah Bird: early on Day 1, mid on Day 4, late on Day 8, post on Day 10).
- Chatter that hints at an answer only runs after the related prediction has closed.
- Generic lines are always the fallback.

## 7. Story tasks, places, events and progression safety

Stories turn the news into play through participatory tasks and visible changes to places, without ever blocking core progress.

**Story tasks**

- Tagged `story:<arc_id>:<task>` and participatory: visit a place, attend an event, share a beat, open an evidence card.
- Earn clout, and can count toward Daily Tasks.
- Side-arc tasks, if any, earn no clout.

**Places and events**

- Effects can spawn, change, restrict or cancel places and events, including free story events (e.g. the Sarah Bird vigil).
- Respect borough gating: if a player hasn't unlocked a borough, its effects and tasks are skipped for that player.
- Place visits keep their per-place cooldown; story effects never reset it.

**Protected systems (effects never apply)**

- Onboarding, the tutorial and the first-task party event.
- The borough unlock flow.
- Sign-up, log-in and all purchase flows (Shop checkout, Stripe Checkout, entitlement grants).
- Bills and rent payments.

**Daily tasks:** the daily task picker only chooses places that are open and off cooldown that day, so a story closure never makes a daily task impossible.

## 8. Premium content, entitlements and payments

The main arc is always free and shared. Revenue comes from side arcs, exclusive events, a few collector fashion items and monument postcards, all gated by one function: `hasEntitlement(player, sku)`.

**Payments (in P1, per the Payments Brief)**

- Stripe Checkout, hosted, one-time payments. The webhook (`checkout.session.completed`) is the only thing that grants access; it verifies the signature and is idempotent.
- The webhook writes an entitlement: player id, `sku`, product type, Stripe session and payment ids, timestamp, status.
- `charge.refunded` revokes the entitlement automatically.
- Prices live in Stripe and config, never hardcoded.

**Side arcs**

- `type: side`, a `parent_arc_id`, `tier: premium` and a `sku`. $2.99 each.
- Buying one unlocks every released beat, and the rest as they release. Side arcs stay purchasable from the News app archive after the story ends.
- Side-arc effects are personal-layer only (the player's own feed items and documents). They never change shared world effects, prices or the main outcome.
- Side arcs add no clout, give no edge in predictions, and are never shown to the `reward_modifier` effect.
- Side-arc cosmetics, if ever added, are $0 possessions. The Sarah Bird pilot has none.
- Locked side arcs show as teasers: title, hook line and a locked card per released beat (headline only).

**Never sell:** the main arc's ending or reveal, extra influence in shared polls, or any information that points at an open prediction's answer.

**Later phase (design for it now):** an insider pass showing news up to 12 to 24 hours early via `visible_at`, while effects still apply on schedule. Rule: no beat is shown early while any prediction it relates to is still open.

## 9. Scope and build sequence

Everything below ships in P1, before public launch. The three stages are a build order, not separate releases; Sarah Bird must run end to end in staging before launch.

**Stage 1: foundation**

- World state module, tag system, server-authoritative clock with time-travel, debug panel.
- Arc and beat `status` (pause/retire).
- News app feed driven by beats, with "Previously" lines and the archive.
- Chatter hook with generic fallback and the four phases.
- Price and availability hooks wired into place visits, event entry and the Shop, returning unmodified values by default.

**Stage 2: story mechanics**

- Live price multipliers, closures and reason text.
- `place_state`, including spawned free story events.
- Story tasks and their link to Daily Tasks.
- Predictions: voting, live results, close and reveal, clout rewards and badges.
- Sarah Bird main arc loaded as data.

**Stage 3: premium**

- Entitlements by `sku`, Stripe Checkout and webhook, refund revocation.
- Side-arc teasers and unlock flow.
- The three Sarah Bird side arcs loaded as data.
- Shared with the exclusive-event and collector-fashion purchases.

**Later:** insider pass, bundles, subscriptions, polls that change story choices.

**Out of scope:** LLM-generated stories, per-player outcomes that change the shared world, cross-arc simulation.

## 10. Example data

An excerpt of the Sarah Bird main arc (4 of 10 beats) and one side arc, as valid JSON. Times are New York time, relative to the arc's day; the full data file follows the Sarah Bird v2 brief.

```json
{
  "id": "sarah-bird",
  "title": "Who Killed Sarah Bird?",
  "type": "main",
  "tier": "free",
  "status": "active",
  "start_at": "2026-11-01",
  "start_weekday": "sunday",
  "borough_scope": ["queens"],
  "answer_key": {
    "killer": "pastor-vale",
    "server_only": true
  },
  "beats": [
    {
      "id": "sb-1",
      "day": 1,
      "status": "active",
      "news": [
        {
          "headline": "Queens' Glass Bird Goes Quiet",
          "previously": null
        }
      ],
      "effects": [
        {
          "type": "availability",
          "tags": ["skyline_pier"],
          "state": "restricted",
          "reason": "Police activity: lobby only",
          "expires_day": 9
        },
        {
          "type": "chatter_topic",
          "topic": "sarah-bird",
          "phase": "early",
          "priority": 2
        },
        {
          "type": "task_injection",
          "add": ["story:sarah-bird:leave-flowers"]
        }
      ]
    },
    {
      "id": "sb-3",
      "day": 3,
      "status": "active",
      "news": [
        {
          "headline": "Best Friend, Better Secret",
          "previously": "Sarah's boyfriend Jett skipped her vigil, and his gym alibi doesn't exist."
        }
      ],
      "effects": [
        {
          "type": "price_multiplier",
          "tags": ["rockaway_diner"],
          "applies_to": "visit_price",
          "multiplier": 1.5,
          "reason": "Fans are packing Sarah's booth",
          "expires_day": 7
        }
      ],
      "prediction": {
        "id": "P1",
        "question": "Why was Theo at Sarah's service door at 2:15 PM?",
        "options": ["To confront her", "To apologize", "To meet Jett", "To take something back"],
        "closes_at": { "day": 4, "time": "23:59" },
        "reveal_beat": "sb-5",
        "correct": "To apologize",
        "reward": { "clout": 50 },
        "changeable": true
      }
    },
    {
      "id": "sb-8",
      "day": 8,
      "status": "active",
      "points_at_answer": true,
      "news": [
        {
          "headline": "Case Closed? (Queens Thinks So)",
          "previously": "The sedative was in Sarah's tea, the thermos is missing, and Jett's lawyer is nervous."
        }
      ],
      "effects": [
        {
          "type": "chatter_topic",
          "topic": "sarah-bird",
          "phase": "late",
          "priority": 2
        }
      ]
    },
    {
      "id": "sb-9",
      "day": 9,
      "status": "active",
      "news": [
        {
          "headline": "The Pastor Is Not Available for Comment",
          "previously": "The internet blamed Jett, but the detective went to Astoria."
        }
      ],
      "effects": [
        {
          "type": "availability",
          "tags": ["radiant_harbor"],
          "state": "closed",
          "reason": "Closed: police activity",
          "expires_day": 10
        },
        {
          "type": "flag",
          "set": "sarah-bird-solved"
        }
      ]
    }
  ]
}
```

```json
{
  "id": "sarah-bird-momager-files",
  "title": "The Momager Files",
  "type": "side",
  "parent_arc_id": "sarah-bird",
  "tier": "premium",
  "sku": "side_sarah_bird_momager_files",
  "status": "active",
  "teaser": "Loretta kept every receipt. Every single one.",
  "beats": [
    {
      "id": "mf-1",
      "day": 1,
      "status": "active",
      "news": [
        { "headline": "Contract, Page 14" }
      ],
      "effects": []
    }
  ]
}
```

The `start_at` date is a placeholder; any Sunday works. Validation rejects a P2 or P3 `closes_at` later than the start of `sb-8`, because `sb-8` is flagged `points_at_answer`.

## 11. Deliverables

Seven deliverables, ending with Sarah Bird passing a full dry run in staging.

1. **Integration report** on the P1 codebase: where each system plugs in, what to touch, what to leave alone.
2. **World state module** with types, resolution, stacking, expiry, `status` handling and protected systems.
3. **Content:** the full Sarah Bird main arc and its three side arcs as data, from the Sarah Bird v2 brief.
4. **Dev tools:** time-travel control and debug panel.
5. **Validation script:** schema valid; dates and expiries make sense; all tags exist; stacking caps hold; no finale collisions; `start_weekday` matches; every prediction closes before any beat flagged `points_at_answer`; no premium beat released before a prediction closes is flagged `points_at_answer`.
6. **Unit tests** for beat scheduling, effect expiry, stacking caps, protected systems, pause/retire, prediction close and reveal, clout from base price, entitlement gating by `sku`, webhook idempotency and refund revocation.
7. **"How to add a new arc" guide:** one page, content-only workflow.

**Acceptance:** with time-travel in staging, every Sarah Bird beat, effect, chatter phase, prediction window and side-arc unlock fires on the right day; a test-mode purchase unlocks a side arc; a replayed webhook does not duplicate it; a refund revokes it.

## 12. Content rules and open questions

**Content rules** (full detail in the Story Quality Brief)

- All characters, officials, celebrities, brands and organizations are fictional or clearly satirized. No real people, real political parties or real companies.
- Real landmarks are allowed only when the name isn't trademarked; otherwise invent a name.
- Serious subjects stay off-screen and non-graphic. Satire targets personalities and absurd behavior, never protected groups, faith itself or grief.
- Tone: NYC, gossipy, a little satirical, in the narrator voice of Lola Lowdown.

**Open questions** (make a reasonable choice and note it unless one blocks the design)

- **HUD in-game time vs. the world clock:** resolved. The game runs two clocks: a fast city clock in the HUD (flavor only) and this layer's real New York calendar for everything shared or paying out. See Clarifications & Updates (v2), section 12.
- **Buying at places:** this brief assumes P1 has no purchases at places, so `shop_price` multipliers apply only to Shop items. If place purchases are added, extend `applies_to`.
- **Exclusive events and collector fashion:** they share `hasEntitlement(player, sku)`, but their own catalogs and pricing live in Clarifications, not in this layer.
