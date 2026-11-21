# Fame perks and rewards that grow with you

Owner, Nov 21 ("build 1 and 2", after the reward-system review). Migration 0175, `lib/fame.ts`.

## 1. Fame perks: what each rank gets you

| Rank | Perk | How it works |
|---|---|---|
| 2 Student Loan Survivor | 🎟️ A free event ticket every week | The week's first event ticket comes back (ledger 'fame_ticket') |
| 3 Side Hustler | 🍳 Your first meal of the day is comped | The day's first meal comes back ('fame_comp') |
| 4 Group Chat Famous | 💌 Celebrities invite you | One celebrity-hosted Scene move a day is free ('fame_invite') |
| 5 On the List | 📸 Lola writes you up | A Spotlight in the News at this rank and every one after (a 'win' headline; never for News opt-outs) |
| 6 Local Celebrity | 🥂 VIP on the house at the medium clubs | (already in the game) |
| 7 Nepo Baby Energy | 🍾 Every VIP rope opens · 🎗️ Your charity gifts are matched | VIP: already in the game. Gala gifts: the clout is matched ('fame_match') |
| 8 New Money Rich | 📷 The paparazzi follow you | Scene moves pay 10% more ('fame_paparazzi') |
| 9 Self-Made Billionaire* | 🪩 Throw your own night | A Scene move at Rank 9 (`own-night`, 24 h, 600 clout, a Blotter line) |
| 10 God Status | 🗽 The Mayor names a day after you | Lola's Spotlight from the Mayor and the badge 'mayor-day' |

Players see them in **Ranks & fame perks** (the leaderboard's button): each rank's perks, which repeating ones are used this
week or today (`fame_state()`), and their multiplier. The rank-up celebration lists the new rank's perks.

## 2. Rewards that grow with you

Everyday rewards (daily tasks, the all-five bonus, visits, events and place activities) pay a bonus of 20% a rank above
the first: ×1.2 at Rank 2, ×2 at Rank 6, ×2.8 at Rank 10 (ledger 'fame_scale', once per payment).

The goal ladder gets ten more rungs for Ranks 6 to 10: skill levels 7, 9 and 10, C$100k to a billion in the bank, a
regular at Ditmars Heights Rooftop, and owning a nightclub (`lib/goals.ts`, rewards C$600 to 10,000).

## 3. One "Known for" for the whole game (migration 0176)

Your Scene's six scores used to count Scene moves only. Now everything feeds one (`KNOWN_FOR` in lib/fame.ts), once per
thing: promotions, paydays, businesses and the Gala → 💼 Status; dates, the crew, hosting, the couple's milestones and
inviting friends → 🤝 Social; club nights, parties, VIP and calendar events → 🎉 Nightlife; the campaign's polls, tasks and
rewards → 🎤 Stage; the Shop and the Crib Rating → 👗 Style; hunts, gossip, place activities, visits, stories and streaks →
🏙️ Street cred. Radio and TV pay nothing today, so they can't count yet.

## 4. Clout Pass XP from everything (migration 0176)

On top of daily tasks (5), all five (20), goals (50) and Scene moves (10): a payday 10, a promotion 40, a campaign week's
poll 15, buying a business 25, upgrading one 20, a date night 15, hosting 10, a party 10, a hunt clue 10, an anniversary 15,
a Crib Rating milestone 20, a plaque 30.

## How it's built

A ledger trigger (`fame_on_ledger`, never raises) watches every payment and adds the perk or bonus as its own ledger row,
so no payment code changed. The rank is the best reached, or what clout and the bank give now. A players trigger
(`fame_on_rank`) posts the Spotlights. `game_settings 'fame'` comes from `fameSettings()` (tests/fame.test.ts compares).

## 5. Credit for small progress (migration 0177, `lib/rewards.ts`)

- **Halfway there:** a goal with an amount to reach (savings, days at a place, a skill level…) that's half done pays a
  quarter of its reward early, once (ledger 'goal_half', a banner). The full reward still comes when it's done. Yes/no
  goals and goals above your clout don't count.
- **Last week:** every Monday, the first time the game opens, a results card shows last New York week: clout gained, C$
  earned, full days, Scene moves and plaques, what you were most known for and the best moment (`week_recap()`).

## 6. Surprises (migration 0177)

About half of New York days, once, a little after the game opens: Lola sends a freebie (C$50 + 25 a rank), a fan asks for
a selfie (10 clout a rank, from Rank 3), a stranger buys your drink at a bar or club (+15 Energy, +5 Mood), or a celebrity
texts an invite to their Scene move hosted today (from Rank 2): start it today and its price comes back (ledger
'surprise_invite'; not twice with Rank 4's own free celebrity move). The server rolls with a crypto random source
(app/home/rewardActions.ts) and `surprise_give` pays once a day. `?rewards=recap|halfway|freebie|selfie|drink|invite` in the preview.
