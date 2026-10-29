# Launch checklist (v1.0)

What to test by hand before the soft launch, on **your phone and one low-end Android phone** (2-3 GB of memory).
Tick each line. Anything that fails: a screenshot and one sentence to Claude Code.

The automated checks (typecheck, 386 game tests, 104 database scenario tests, story and content checks, the build)
run on every change; this list is the part a person has to see.

## Before you start
- [ ] Every database update is in: [scripts/migration-status.sql](../scripts/migration-status.sql) in the Supabase SQL
      editor says **run** on every row.
- [ ] Stripe is still in **test mode** for this pass (card 4242 4242 4242 4242, any future date, any CVC).
- [ ] Stripe's public details have your **Terms URL** (Settings → Public details), so checkout shows the EU/UK tick box.
- [ ] Stripe Tax settings checked for digital goods (Settings → Tax).

## 1. First visit (signed out)
- [ ] The welcome screen shows the city map; "Play now, no sign-up" starts the demo; the demo's end card sends you to
      sign-up.
- [ ] Sign up with a new email: date-of-birth step, magic link arrives, the creator opens.
- [ ] Under-18 birthday: sign-up closes on that phone.
- [ ] A creator link (`/c/<slug>`) and an invite link both carry through sign-up (the welcome gift / the inviter's count).

## 2. First session
- [ ] Creator: look, traits, birth lottery, home. Lola's tour plays through to the end, Mayor Papa-Dani's step included.
- [ ] The first party, the first daily tasks, Starter Week's pill and its glowing place on the map.
- [ ] Close the app inside a place and reopen: you're back where you were.

## 3. The city
- [ ] Map: drag, pinch, tap a dot and a name (the place's card opens), the locked boroughs' cards, day and night.
- [ ] Travel by walking, subway, cab and rideshare; a place that's closed says when it opens.
- [ ] Do one action at a café, a club (door, restroom, VIP floor), a park and a campus.
- [ ] Rent: pay a bill; the rent alarm appears when the bank is short.

## 4. Social
- [ ] Chat with a second account: send, receive, block, report. The 20-a-day limit shows the unlimited offer.
- [ ] Crew invite, a crew outing, a crush match and a date night with the second account.
- [ ] Mayor app: send a letter; reply from Studio → Mayor's Inbox; the reply shows in the app.

## 5. Real money (test mode)
- [ ] VIP monthly: buy, see it in Settings → Membership; cancel in the billing portal; it runs to the end of the period.
- [ ] Unlimited chat, a side story, a Couture piece (the over-$50 confirm sheet), a monument postcard after a visit.
- [ ] Refund one purchase from the Stripe dashboard: the item is taken back.
- [ ] Studio → Insights shows the purchases; a referred player's purchase shows a creator commission.

## 6. Features
- [ ] Shop: buy with C$, try on, wear; Furniture: place a piece at home; the Crib Rating pill moves.
- [ ] Have people over; a sublet listing; the lotto; a treasure hunt clue; the Tea app; Real Clout FM; Clout TV upload.
- [ ] Campaign Mode at Rank 2: pick a candidate, plan a week, reply in the Inbox, End Week; the poll result arrives
      the next day.
- [ ] Push notifications: allow them, close the app, get one (a chat message is quickest).

## 7. Account
- [ ] Settings: Low graphics on and off; analytics consent switch; Log out.
- [ ] Start over (on a test account): back to the creator, real-money items kept.
- [ ] Delete my account (on a test account): type DELETE; signed out; the email can sign up fresh.

## 8. Low-end Android
- [ ] The game opens in under ~5 seconds on 4G; the map scrolls without stutter; the phone doesn't get hot after
      10 minutes.

## Go live
1. Stripe → **live mode**: live keys and webhook secret in Vercel (docs/SETUP.md), products created live.
2. One real $1.99 postcard purchase, then refund it. Both show in Stripe and in the game.
3. The lawyer's read of Terms, Privacy and the 18+/lotto wording is done.
4. Invite the 20 to 50 soft-launch players.
