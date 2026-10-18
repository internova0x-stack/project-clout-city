# Creators: the affiliate program and video tracking

How the team runs the creator program day to day: adding a creator, making their links, how players are credited,
what creators earn, how creators see their own numbers, paying them, and tracking the videos we pay for. The rules
and the reasons behind them are in `docs/08-new-features-spec.md` section 21; this page is the how-to.

Everything here lives in the Story Studio (`/studio`) under **Affiliates**, except the creator's own page
(`/creator`). Only Studio admins can see or change any of it.

## The deal in one paragraph

A creator gets a code (`TASHA`) and links (`/c/tasha`, `/c/tasha-tiktok`). A new player who signs up through one of
them is theirs, for good (the first creator wins). For every real-money payment that player makes inside the
creator's window (12 months, 24 months or for life), the creator earns their rate (20% by default, 30% for high
performers, anything up to 50%) of the **net**: the price minus Stripe's fee and tax. Earnings are held 45 days so
refunds land first, then they're payable; we pay monthly once a creator has $50 payable. The player gets an in-game
welcome gift (C$ and a free Shop outfit item) for joining through a creator. Nothing a creator does touches the
lotto, and the welcome gift is never real money, VIP or anything sold for real money.

## 0. Setup (once)

1. Run the migrations in the Supabase SQL Editor, in order: **0087** (creators and links), **0088** (commissions),
   **0089** (the creator page), **0090** (payouts), **0091** (videos). If the editor warns about Row Level Security,
   choose **Run and enable RLS** (each file already turns it on). Studio → **Setup** lists each one as run or not.
2. Stripe: no new webhook events are needed (the endpoint in `docs/SETUP.md` already sends `checkout.session.completed`,
   `invoice.paid` and `charge.refunded`). If you use a restricted key, give it read access to PaymentIntents,
   Charges, Balance transactions and Invoices, so commissions use Stripe's real fee rather than an estimate.
3. Optional: set `NEXT_PUBLIC_SITE_URL` in Vercel to your real address, so copied links and QR codes always use it.

## 1. Registering a creator

Studio → Affiliates → **Creators** → **＋ Add a creator**.

| Field | What to put | Notes |
| --- | --- | --- |
| Name | How we refer to them | Shown on their page and in the Studio |
| Handle | `@tashaglow on TikTok` | For our reference |
| Email | The email they'll sign in with | **This is how they get into their page.** It also stops their own account earning on itself |
| Creator code | 3 to 16 letters and numbers, e.g. `TASHA` | Typed at sign-up. Unique. Their first link is made from it: `/c/tasha` |
| Rate | **20%** base, **30%** high performer, or a custom rate up to 50% | A change applies to payments from then on |
| Length | **12 months**, **24 months** or **for life** | Counted from each player's sign-up. A player keeps the length set on the day they signed up |
| Welcome gift | C$ (default 500, up to 2,000) and an optional Shop fashion item | In-game only; paid once when the player's account is made |
| Terms agreed on | The date they accepted the creator terms | Shown on their page |
| Status | Active or Paused | See below |
| Note | Anything for the team | Admins only |

**Editing:** tap a creator (in Creators, or in the Overview's top list) to open their page, then **Edit rate,
length, gift**. Rate, length and status changes are logged.

**Pausing:** a paused creator's links still send visitors into the city, but new clicks and sign-ups stop counting.
They **keep earning** on players they already brought in (the agreement still runs). Their page tells them they're
paused.

## 2. Making custom links

Studio → Affiliates → **Links** → **Make a link**.

1. Pick the creator.
2. Type the link: letters, numbers and single hyphens, 2 to 40 characters. Start with their code so links stay
   recognisable: `tasha-tiktok`, `tasha-halloween`. The Studio checks it's free as you type. Links are never
   deleted, so a used one can't be reused.
3. Give it a label (`TikTok bio`, `Halloween video`): the creator sees it on their page.
4. Choose where it lands:
   - **The city (home):** the front page, with "<creator> sent you" and the gift named.
   - **Sign-up, open:** the same, with the sign-up sheet already open.
   - **News**, **The Shop**, **VIP plans:** players who already have an account go straight there; guests land on
     the front page.
5. Optional: a campaign name and the video's URL.

Each link row has **Copy**, **QR** (a QR code you can save as a PNG for a video end card or a poster) and **Retire**.
A retired link still lands visitors in the city but stops counting clicks and sign-ups; **Bring back** undoes it.
Give every paid video its own link, so its results show separately (section 7).

## 3. How players are credited

- **Through a link:** the click is counted (one number per link per day, no personal tracking) and the link is
  remembered on that device for 30 days. When they sign up (email or Google) the account is credited to the creator.
- **With a code:** on the sign-up sheet, **Got a creator code?** opens a field. Codes are typed in any case.
- **Rules:** the first creator wins, forever. Only brand-new accounts are credited (less than a day old). A link beats
  a typed code. A creator's own email never counts. Crew invites still pay the inviter as usual; they don't compete.
- **The welcome gift** lands when the account is made: the C$ in the Bank and the item in Your Look.
- **Changing who a player is credited to** isn't in the Studio yet. Ask a developer (it's one row in
  `creator_referrals`, and it should be logged).

## 4. What creators earn

- One commission per payment by a credited player, purchases and VIP renewals alike, inside the creator's window.
- **Net:** price − Stripe's fee − tax. The fee comes from Stripe; if Stripe can't be read it's estimated at
  2.9% + 30¢ and the row shows an asterisk.
- **Rate:** the creator's rate on the day of the payment.
- **Refunds**, full or partial, take back the same share. If the commission hasn't been paid, it comes back inside
  its hold; if it has, it comes off the next payout.
- **States:** *Held* for 45 days after the payment, then *Payable*, then *Paid* once a payout includes it.

## 5. Watching performance

- **Overview:** clicks, sign-ups, paying players, revenue, commission, what we keep after commission, held and
  payable, charts by day, top creators and top links. The period chips (7, 30, 90 days, all time) apply.
- **Creators:** the table adds payers, revenue, commission, held, payable, paid and kept. A red **⚑ refunds** flag
  shows when more than 20% of a creator's players' payments were refunded.
- **A creator's page** (tap them): the funnel (clicks → sign-ups → moved in → first purchase → VIP), what their
  players bought, next-day / day-7 / day-30 return, commission history, and **the players they brought in**. That
  list is admin-only: creators never see who their players are.

## 6. Giving a creator access to their dashboard

1. Make sure the **Email** on their creator profile is the one they'll use.
2. Send them the address: `https://<your site>/creator`.
3. They enter that email and get a 6-digit code (or use Google with the same address). They don't need to play
   the game or have an account first: signing in makes one.

They see their code (with Copy) and their terms, earnings (payable, held, paid, earned in all), the next payout date
or how far they are from $50, 30-day charts, every link with clicks, sign-ups, paying players and earnings (plus a
"typed your code" line), earnings by month, their payouts, and the fine print. Their links are read-only: only
admins make links.

If they see "This email isn't on the creator list", the email they used doesn't match their profile. Fix the email
in the Studio (Edit) and have them sign in again.

A message you can send:

> Your Clout City creator page is live: https://<your site>/creator. Sign in with <their email>; we'll email you a
> code. Your code is **TASHA** and your main link is https://<your site>/c/tasha. Label every post #ad (or the
> platform's paid-partnership tag), keep it to 18+ audiences, and please don't promote the lotto.

## 7. Video tracking (the UGC engine)

Studio → Affiliates → **Videos**.

1. **Before the video:** make it a link of its own in Links (`tasha-halloween`) and send the creator that link and
   their code to show on screen.
2. **When it's posted:** **＋ Log a video**: the creator, its link, a title, the platform, the post date, the fee we
   paid, and optionally the URL and a note (for example the brief).
3. **Read the results:** each video shows clicks, sign-ups, paying players and revenue through its link, and the
   fee **per paying player**. A video logged without a link ("code only") has no numbers of its own; its fee still
   counts toward the creator.
4. **Cost per creator** (all time): their total fees against sign-ups, paying players, revenue and commission, the
   cost per sign-up and per paying player, and **Kept** = net revenue − commission − fees. Red means a creator has
   cost more than they've brought in so far.
5. If a video is taken down, mark it **Removed**: it leaves the video count but its spend still counts.

## 8. Paying creators (monthly)

Studio → Affiliates → **Payouts**. At the start of each month:

1. Look at **Owed today**: each creator's payable amount (after the 45-day hold). Anyone under $50 is tagged and
   rolls over to next month.
2. **Download CSV** for everyone ready to pay (creator, email, handle, code, amount, date) and send the money by bank
   or PayPal.
3. For each creator, **Mark paid…**: the method, your transfer reference and a note, then **I've sent $X**. Every
   payable commission for that creator goes into that one payout, and it shows on their page as paid.
4. To pay below $50 (for example, closing a deal), tick **Pay below the minimum**.
5. Marked the wrong one? **Undo…** in the history, with a reason: it stays listed as undone and the money is
   payable again.

Never type bank details into the Studio; your own reference is enough. Stripe Connect (creators onboard themselves,
Stripe pays them and files their tax forms) is coming later.

## 9. The rules creators agree to

- #ad or the platform's paid-partnership label on every post.
- 18+ audiences only.
- No promoting the lotto, no promises about features that aren't built, no real brands.
- No buying followers or paying for installs.
- Their own purchases never earn anything.

## 10. Troubleshooting

| What you see | Why, and what to do |
| --- | --- |
| "The database is missing a step" or "Run migration 00XX first" | Run that migration (section 0); Setup shows which |
| A sign-up didn't count | The account was older than a day, it was the creator's own email, the creator was paused, or the link was retired. A typed code only counts on the sign-up sheet |
| Clicks but no sign-ups on a link | The link works; people just didn't sign up. Check where it lands |
| A commission shows a fee with * | Stripe couldn't be read for that payment; the fee was estimated. Check the Stripe key's read access (section 0) |
| A creator's "Payable" is negative | A refund came in after their commission was paid; it comes off their next payout |

## Previews (development only)

- `/preview/studio` → Affiliates: every view on sample creators (nothing is saved).
- `/preview/guest?via=tasha` and `?via=tasha-signup`: what a guest sees after following a creator's link.
- `/preview/affiliate` (`?state=new|paused`): the creator page.
