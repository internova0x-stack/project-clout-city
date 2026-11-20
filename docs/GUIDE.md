# The Guide

The answer to "what do I do next?" (owner, Nov 20). The full step list (89 steps, 11 chapters, with tips, explainers,
actions, checks and rewards) is the owner's Claude Doc "Clout City Guide: the step list"
(https://claude.ai/artifact/JsLbmknVXdfs6u3Mguyi28); the clickable mock-up of Chapter 1 is
https://claude.ai/artifact/V1x7duTPhWNARC12Vyy7s5.

## How it plays
1. **Tip**: Lola's card (or a cameo's) with the step's line and reward. "Show me how" or "Later".
2. **Explainer**: two or three cards.
3. **Show me**: the real button gets a glowing ring (taps go through to it) and Lola's hint.
4. **Done**: the game sees it done, pays once and shows a banner; a chapter's last step adds a takeover with its badge.

The pill under "Invite your Crew" always names the one recommended step (Starter Week's pill is hidden: its missions are a row in the Guide app). There's
no Guide tab in Tasks (owner, Nov 20); the Phone's Guide app lists every chapter and step, and any open step plays from
there (a skipped optional one too). Lola's tip pops up once per step per device, only when nothing else is open.

## Adding a chapter
Write its steps in `lib/guide.ts` (`STEPS`), set the chapter `live: true`, then add a migration that updates
game_settings 'guide' to `guideSettings()` (tests/guide.test.ts compares it with the latest migration that sets it). Each
step's `check` is one of: `seen` (GameShell calls `guideSeenMark` when the screen opens), `ledger` kinds, `gossip`,
`events`, `streak`. `targets` are CSS selectors (or `text:<button words>`) for the glow, tried in order.

## Starter Week
The Guide replaces Starter Week for new players (owner, Nov 20). When migration 0170 runs, game_settings 'starter' gets
`until`: accounts made after it never start Starter Week; players already in their week finish it (a row in the Guide app).
Chapter 1's finish pays Starter Week's prize instead: C$1,000 and the violet rug. Businesses, Jobs and Campaign still wait
until day 3, counted from the account's first New York day.

## Optional steps
Steps some players can't or won't do (dating, gifts, together plans, holding, Pablo, the Gala, Clout TV, the Mayor, every
Big play) are `optional: true`: they pay when done, the chapter doesn't wait for them, and their tip card has "Not for me:
skip this one". Big plays finishes after any three of its steps (`need: 3`).

## Not doing it
Nothing is locked behind the Guide. "Later" closes the card and the pill stays; steps the player does on their own are
still noticed and paid; the tip for a step pops up once per device.
