# Security review (v1.0, Oct 29)

Three reviewers read the whole game before launch: **money** (Stripe checkout, the webhook, refunds, chargebacks, Couture
editions, creator commissions), the **app surface** (sign-in, server actions, the Studio, uploads, chat, headers) and the
**database** (every migration run on a fresh Postgres with Supabase's default grants, then the final functions,
permissions and row security checked one by one).

**Nothing critical or high.** Every write goes through checked functions, every admin tool checks for an admin first,
no answers (hunts, exams, stories, gossip) reach a player early, and every reward pays once.

## Fixed (migration 0130 and the code beside it)

| # | Level | What could happen | Fix |
|---|---|---|---|
| 1 | Medium | A player could start several checkouts for one Couture piece (or call the checkout function with made-up session ids) and hold copies, so a drop showed "sold out" to everyone else. | One open checkout per player per product; a new one replaces the old. Held copies count once per player. |
| 2 | Medium | Two checkouts open at once (two tabs, or monthly and yearly VIP) could both be paid: a double charge, or a VIP plan the game didn't track. | The older checkout is closed in Stripe when a new one starts (if it was already paid, the new one closes instead). |
| 3 | Medium | Another website could send a player's browser to the sign-in link with its own token (signing them in to the wrong account). | Sign-in only accepts the game's own Continue button (Origin check). |
| 4 | Medium | Another website could show the game inside a frame and trick taps (clickjacking). | Headers on every page: no framing, no type guessing, strict HTTPS, a short referrer. |
| 5 | Medium | A player could register any web address as a "phone", and the push sender would call it. | Only the browsers' real push services are accepted (in the database and in the sender). Another account can't take over a device. |
| 6 | Low | Delayed payment methods (bank debits) could pay for a numbered piece after the drop sold out. | Numbered pieces are paid by card (Apple Pay and Google Pay included). |
| 7 | Low | A full refund of a VIP payment didn't end VIP. | The webhook cancels the subscription, as a lost chargeback already did. |
| 8 | Low | A later payment could swap the Stripe customer saved for the billing portal. | The first saved customer is kept. |
| 9 | Low | The lotto pot's size dropped as soon as a card won it, so a buyer could tell before scratching. | The pot shows as still there until the winning card is scratched. |
| 10 | Low | Opening the Studio's story list ran the weekly content sync before checking for an admin. | Admin check first. |
| 11 | Low | About 25 functions were callable signed out (each refused, but needlessly open). | Signed-in only. |

## Known and accepted

- **Campaign odds in the preview's code chunk:** the file is referenced only by `/preview` (a 404 in production), but a
  determined player who finds the chunk could read the odds. It holds no answers or prizes.
- **Age and outfit checks live in the sign-up server action:** calling `create_player` directly skips the device block
  for under-18s and the outfit check (the database still caps the outfit's size). The age answer is self-declared
  either way. Worth moving into the database before a marketing push.
- **Creator video links** take any URL; only admins add them.

## Doing it again

`npm run test:db` runs `supabase/tests/security_review.test.sql`; `tests/push.test.ts` keeps the push-service list in
step with the database. A new function players can spam goes in a rate bucket (lib/rateLimits.ts).
