# Clout City: Campaign Mode (incl. Shadow Ops)

**Feature:** a self-paced mayoral race. The player is a **campaign manager** who picks one of four challengers
and runs their campaign against the incumbent, Mayor Papa-Dani. Shadow Ops are the dark-arts layer underneath.
**Status:** spec v0.5 (Oct 29, 2026). The 4-week test build is in the game (migrations 0127 and 0128). Every number is a starting value for playtests.
**Hook:** *"Fake it until the city finds out."*

**Changes from v0.4 (owner, Oct 29):**
- Papa-Dani stays the friendly mayor and is the incumbent.
- The player is the campaign manager and picks one of four challengers (section 2), each with a bio, an issue
  platform and their own strengths.
- Papa-Dani's voice rules are updated for the campaign (section 2.1 and docs/CAST.md).
- The review fixes:
  - one campaign length everywhere;
  - one test-build scope (section 18), with Favor trading left out of it;
  - every roll on the server, rate limits, and caps on the money skimmed into the main game (section 15);
  - unlock at Rank 2;
  - a smaller penalty for losing;
  - per-player scandals as a new kind of Tea item;
  - section order cleaned up.

---

## 1. Concept

The player runs a challenger's campaign to unseat Mayor Papa-Dani. Every spend and decision moves **two
ratings**: the candidate's and the Mayor's.

- **A clean path is slow and durable. A dark path is fast and fragile.** The tension between them is the game.
- **The player is the campaign manager,** not the candidate. They pick the candidate, set the budget, book the
  calendar, take the meetings, call the plays in debates, and decide how dirty to get. The candidate is a
  character with opinions: they push back, take credit and sometimes go off-script.
- **Self-paced:** played in chapters (Acts) at one campaign week per real day (section 4.4).
- **Part of Clout City:** the manager's clout, crew and money feed the campaign, and the campaign feeds back into
  their Clout City life (section 5).
- **Replayable:** each candidate has different allies, temptations and weak spots, so a run with a different
  candidate plays like a new game.

---

## 2. The candidates

### 2.1 The incumbent: Mayor Papa-Dani

He is the same friendly mayor players already know from City News and the Mayor app. He is enthusiastic, everywhere
at once, cuts a ribbon on every fix, and says "Neighbor! My door is always open!"

**His record** is fixing small, visible problems fast: potholes, benches, a working water fountain. **His weakness**
is that the big problems (rent, the 7 train, flooding) keep growing while he's busy with ribbons. Every challenger
attacks a different big problem, so the race is about his job, not about him being a bad person. He is sometimes
right, and players should feel that.

**His voice in the campaign** (rules in docs/CAST.md):
- He stays warm. He campaigns on his record ("Forty-one potholes this month, neighbor!") and never insults the
  challenger personally.
- He jabs at a challenger's weak spot with a smile:
  - Goldcrest: "out of touch";
  - Castellano: "all charts, no heart";
  - Kowalczyk: "still fighting 2009";
  - Starr: "not serious".
- His dirty tricks come from **his campaign machine** (aides, fixers and allies), never from his own mouth. He can
  look shocked when one is exposed.
- He concedes graciously, or wins graciously. He calls the manager on election night either way.

### 2.2 The challengers

**1. Preston Vale Goldcrest III, "The Disruptor"**

*Bio:* Goldcrest inherited a parking-garage empire and calls himself self-made. He founded Goldcrest Holdings, which owns
eleven luxury towers, a members-only kombucha bar and $QUEENS, a crypto coin that failed. He has never ridden the
subway, though he once funded a documentary about it. He is charming in a way that makes you check your wallet.

*Slogan:* "Let's run this city like a business. Mine."

*Issues:*
- **Towers everywhere:** rezone Astoria for luxury high-rises. "Supply! Eventually, trickling down!"
- **The private city:** a premium Concierge Lane on the expressway, private security patrols, VIP lines at the
  motor vehicles office.
- **Tax breaks for job creators,** meaning himself.
- **A gondola over the East River,** his signature project, at C$40 a ride.

*How he plays:*
- **Strengths:** the most campaign cash, the best donor network, strong TV and Digital.
- **Weaknesses:** the lowest starting Integrity (55). Street Teams barely work, because nobody believes he has
  knocked on a door.
- **Temptations:** dirty-money offers come early and often.
- **Off-script risk:** he says something rich in public ("Who takes the bus?").

*Satire target:* billionaires who think buying something means fixing it.

**2. Dr. Ingrid Castellano, "The Professor"**

*Bio:* Castellano is a former professor of urban systems at St. Johnsons University. She wrote a 600-page report on the 7 train
that nobody at City Hall read, so she is running to read it to them. She is methodical and dry, and always has a
chart. Her students loved her and her colleagues feared her office hours.

*Slogan:* "I've done the math. You're welcome."

*Issues:*
- **Transit that runs:** signal upgrades for the 7, bus lanes, and arrival times that don't lie.
- **Flood-proofing Queens:** green roofs, storm drains, a seawall along the waterfront before the next big storm.
- **Schools and libraries:** longer library hours, free tutoring, smaller classes.
- **Open books:** a public site showing where every city dollar goes, with a budget she audits herself.

*How she plays:*
- **Strengths:** the highest starting Integrity (85), the best Pollster bonus, strong "Facts" answers in debates.
- **Weaknesses:** weak fundraising, and Charm answers often fall flat.
- **Temptations:** "the data is wrong, just round it up" offers. Dirty ops cost her 1.5 times the usual Integrity.
- **Off-script risk:** a 40-minute answer at a rally.

*Satire target:* the expert who is right and can't make anyone care.

**3. Frankie "The Hammer" Kowalczyk, "The Organizer"**

*Bio:* Frankie ran Local 117 of the city's transit workers for 12 years, and he has a knee that "remembers the strike of '09."
Loud, warm and impossible to bully. Knows every bodega owner in Woodside by first name and brings a thermos to every
meeting. Stepped down at 41, was bored in three weeks, and started a campaign.

*Slogan:* "This city runs on people. Pay 'em."

*Issues:*
- **Rent:** caps on rent hikes, a tenant hotline someone actually answers, and fixing the boilers in public
  housing.
- **Wages:** a raise for city workers, delivery riders and home aides; "no more unpaid overtime."
- **Keeping the neighborhood:** protect small businesses and bodegas from the towers. This is a direct clash
  with Goldcrest.
- **Safety the old way:** crossing guards, streetlights, night buses.

*How Frankie plays:*
- **Strengths:** the strongest Street Teams, crew volunteers count double, union stakeholders are friendly from day
  one, and staff Loyalty is high.
- **Weaknesses:** thin TV money and weak Digital ("What's a hashtag?"). Pressure works in meetings; bluffs don't.
- **Temptations:** "lean on the vendors" offers.
- **Off-script risk:** picks a fight with a heckler.

*Satire target:* the lovable old-school fighter who can't stand change.

*Frankie is a man (owner, Oct 29): he, him.*

**4. Kaylee Starr, "The Influencer"**

*Bio:* Kaylee has 2.3 million followers, a sponsored tea, and a "Mayor era" announced in a get-ready-with-me video. She
decided to run when City Hall didn't repost her, and she is surprisingly good at it.

*Slogan:* "Vote for vibes."

*Issues:*
- **Nightlife:** clubs open until 6am, "content zones" in every park, a ring-light at every subway stop.
- **Free Wi-Fi citywide,** sponsored by her tea.
- **The 2am Slice Protection Act:** pizza places stay open late.
- **Making New York "iconic again."** Asked for details: "it's giving iconic."

*How she plays:*
- **Strengths:** the best Digital results and the biggest swings, both ways.
- **Weaknesses:** very likely to be fact-checked, and weak in debates unless the manager preps a lot.
- **Temptations:** bot networks and paid followers.
- **Off-script risk:** goes live at the wrong moment.

She is the most fun campaign to play and the hardest to win cleanly.

*Satire target:* fame as a qualification, which is Clout City's whole premise.

### 2.3 Where they clash

| Issue | Papa-Dani | Goldcrest | Castellano | Kowalczyk | Starr |
|---|---|---|---|---|---|
| **Rent and housing** | Fixes what's broken, one building at a time | Luxury towers | Mixed-income zoning, by the data | Rent caps, tenant rights | "Cute apartments for everyone" |
| **Transit** | A ribbon on every new bench | Private express lanes, gondola | Fix the signals, bus lanes | Night buses, pay transit workers | Ring-lights at stations |
| **Small business** | Shop-local photo ops | Sell the block | Grants by the data | Protect the bodegas | Sponsor deals |
| **Safety** | More officers at events | Private patrols | Streetlights, crime data | Crossing guards, night buses | "Good vibes deter crime" |
| **Climate and parks** | Plants a tree on camera | Rooftop pools for residents | Seawall, green roofs | Park jobs for locals | Content zones |
| **Money** | A little for everything | Tax cuts, mostly his | Open books, audited | Tax the towers | Brand partnerships |

### 2.4 What the pick changes

- **Starting meters:** each candidate has their own starting Integrity, cash and channel strengths (section 2.2).
- **The stakeholder map:** who is warm, cold or hostile at the start.
  - Kowalczyk's union heads are cold to Goldcrest.
  - Goldcrest's donors won't take Castellano's calls.
  - Academics and librarians love Castellano.
  - Nightlife owners and creators love Starr.
- **Boroughs and blocs:** each issue matters more to some places than others (renters, commuters, small business
  owners, nightlife, families), so a platform wins some places and loses others.
- **Temptations:** each candidate draws their own kind of dirty offer (section 2.2).
- **Papa-Dani's counterattacks** aim at that candidate's weak spot.
- **Situation cards and lines:** a shared pool, plus a few cards and every dialogue line written per candidate.
- **The candidate has a will of their own.** A candidate can refuse an op that clashes with their values (Castellano
  won't fake data, Kowalczyk won't cross a picket line). The manager can talk them round at a cost to Morale.

---

## 3. Structure: four acts

| Act | Name | Weeks | Focus | Typical goal |
|---|---|---|---|---|
| 1 | **Rumor** | 1 to 2 | Learn the tools, small leaks, cheap wins, first staff | Reach an Approval target in one place |
| 2 | **Momentum** | 3 to 4 | Team, allies and sponsors; the Mayor starts fighting back | Compete across several places |
| 3 | **Crisis** | 5 to 6 | Big scandals, risky choices, point of no return | Survive attacks and reach the debate |
| 4 | **Election** | 7 to 8 | The final stretch | Win, lose, or something in between |

The full campaign is **8 weeks**: two per act, each act with its own Approval target. The test build is 4 weeks in
one borough (section 18).

**Later roles:** Fixer (works the shadows) and Defender (runs Papa-Dani's own campaign).

---

## 4. How a turn plays

### 4.1 The weekly turn

The campaign is turn-based: one turn is one campaign week, and the calendar only moves when the manager taps
**End Week**.

| Step | What the manager does |
|---|---|
| 1. Read the inbox | Invites, requests, tips, threats and anonymous messages, each with a deadline and a trust label (Verified, Unverified, Anonymous) |
| 2. Plan the week | Fill about 10 Day and Evening slots around fixed events: meetings, tour stops, rallies, donor calls, ad buys and Shadow Ops. Travel between places uses part of a slot; big items need lead time |
| 3. Set the budget | Split campaign cash (C$) across Digital, Street, TV and payroll |
| 4. End Week | The week plays out as short text beats, with 1 to 3 situations to decide in the moment (section 6). Meetings are quick dialogue choices (charm, pressure, pay, promise, bluff); events succeed or flop; ops resolve |
| 5. See the results | Next morning: the poll tick shows both ratings with a margin of error, Heat decays, hidden traces roll for discovery, and the Mayor's machine responds |

**The central choice every week:** spend slots and money on slow, durable clean moves (street teams, public dinners,
colloquiums), or on fast, fragile dark ones (Fake News, Poach Ally) that raise Heat and leave traces that can
surface weeks later.

**A typical 10-minute session:**
1. Answer three messages.
2. Book a park-bench meeting with one of Papa-Dani's aides who wants to switch sides.
3. Buy a digital push and schedule a tour stop.
4. Tap End Week.

**Screens:**
- **HQ:** the candidate, the meters, the team and the consequence log.
- **Calendar:** the week's slots.
- **Inbox:** messages and tasks.
- **City Map:** ratings by place.
- **Ops:** Shadow Ops, which appear with the first dark offer.

### 4.2 Calendar

**Event types:**
- **Fixed:** debates, the filing deadline, the fundraising close, a gala. The manager plans around them.
- **Manager-scheduled:** meetings, tour stops, rallies, donor calls, ad buys, ops.
- **Reactive:** Under Attack alerts, Exposure Events and inbox deadlines, each with a response window.
- **Opponent:** Papa-Dani's rallies and announcements. They are visible only with intel, and they are the targets for
  Sabotage and counter-programming (later).

**Rules:**
- **Slots:** about 10 usable slots a week, up to 3 of them meetings.
- **Lead times:** TV and radio need 2 days, rallies 3 days, fundraising dinners 2 days.
- **Double-booking** forces a choice. Sending a staffer instead gives a weaker result.
- **Overscheduling** lowers staff Morale and the candidate's performance. Light weeks restore them.
- **Rescheduling** costs Trust with a stakeholder, or C$ with a vendor.

### 4.3 Skipping a week

Allowed, with real consequences:
- Papa-Dani rises everywhere and the candidate drifts down.
- Unanswered messages expire, cooling those relationships.
- Fixed events happen without the campaign.

The skip screen spells this out before the manager confirms.

### 4.4 Daily rhythm: one campaign week per real day

| Rule | How it works |
|---|---|
| **One week per real day** | Inside a week the manager plays freely. **End Week** can be tapped once per real New York day, resetting at midnight like the chat limit |
| **Results arrive overnight** | The results are revealed the next morning as a newspaper recap: Lola's headline, the new polls, and what changed and why |
| **Length** | 8 days for the full campaign (4 for the test build), at about 10 to 15 minutes a day, longer on debate and Election Day |
| **Absence never hurts** | The calendar never moves without the manager. Only choosing to skip a week has consequences |
| **Deadlines use campaign time** | "Expires Thursday" means campaign Thursday, never a real date |
| **No paying to skip the wait** | Real money never speeds up the clock |
| **Reminder** | A push ("Your poll results are in") only for players who turned notifications on, under the existing push rules |

---

## 5. Connection to the main game

### 5.1 Unlock

- **When:** at **Rank 2** (owner, Oct 29), the same rule as Businesses and Jobs (`APP_UNLOCKS`; the rank is a
  setting, `campaign.unlockRank`).
  - *Timing to know:* Rank 2 is 100 clout, and the first party pays exactly 100. Most players reach it at the end of
    their first session, so the teasers below mostly show during that session.
  - *Kept at Rank 2* (owner, Oct 29) over Rank 3: the mode opens fast, and the teasers work as "coming right up".
- **How it's introduced:**
  - a Lola News item: "Three challengers, one Mayor, and they all need a manager";
  - an inbox invitation from each candidate;
  - Lola's `UnlockReveal` once.
- **Teasers before the unlock** (owner, Oct 29). Players should know an election is coming and that Rank 2 opens
  it. All of these ship with the mode, never before it, because the game never promises what isn't built.
  - **City News "Upcoming election" card:** a distinct election-poster treatment (red, white and blue bunting, the
    four candidates' faces, "🗳️ Upcoming election: Become a campaign manager").
    - **Before the unlock:** it shows the rank target and progress ("Unlocks at Rank 2 · 62/100 🔥") and turns up
      **occasionally**: in the launch News rotation about one visit in four, and at most once a day in the feed.
    - **Tapping it** opens a teaser sheet: the four candidates with slogans, "Reach Rank 2 to run one of their
      campaigns", and how to earn clout fast (the tasks, the first party).
    - **After the unlock with no campaign running:** the card becomes "Pick your candidate ›".
    - **During a campaign:** it becomes the poll card.
  - **The Rank 2 reveal:** the rank-up card lists what opens, "Unlocks: Businesses, Jobs and **Campaign Mode**", and
    the rank ladder shows the 🗳️ next to Rank 2.
  - **The locked Phone app:** the Campaign app shows "Rank 2" until then. Tapping it opens the same teaser sheet.
  - **The world:**
    - Campaign HQ on the map has a "Coming soon: Rank 2" poster;
    - the candidates' campaign posters hang at a few Astoria places;
    - regulars mention the race now and then (Sal: "Election's coming. Everybody wants my bodega in their ad.").
  - **The weekly content:** once the mode ships, City News carries one election item a week (Lola's race gossip, or
    Papa-Dani on his record). The news validator can require it, the way it requires the Mayor's item.
  - **Lola's nudge:** one Lola tip in the first session: "Psst, babe. There's an election coming and every candidate
    needs a manager. Hit Rank 2 and you're in."
- **Low clout** just means starting as the underdog's manager: "Nobody's heard of you yet, babe. Neither have they."
- **The entry point** (proposed):
  - **Main door:** a **Campaign** app on the Phone. It's locked with "Rank 2" until then, like the other locked apps,
    and opens on the candidate pick, or on HQ once a campaign is running.
  - **Second door:** a fictional campaign office on the map, **Campaign HQ** (a storefront in Astoria). Its card opens
    the same app, so the manager can stand in the office in 3D.
  - **The daily nudge:** the morning recap and "Your poll results are in" open the app (`/home?open=campaign`).

### 5.1a Campaign goals and daily tasks

**Goals on the ladder** (`GOALS.ladder` in lib/goals.ts, game_settings 'goals'):
- Goals pay once (ledger 'goal'), like every goal.
- Each needs a new `check` type the server's `goal_list` reads from the campaign tables.

| Goal | Unlocks at | Reward (clout) | Check |
|---|---|---|---|
| **Pick your candidate** (start a campaign) | 0 (shows as the next goal before Rank 2, so the ladder points at it) | 75 | `campaign_started` |
| **Make it to week 3** | 100 | 75 | `campaign_week: 3` |
| **Win a debate** | 500 | 150 | `debate_won` |
| **See it through** (finish a campaign) | 500 | 150 | `campaign_finished` |
| **Make a Mayor** (any win) | 1,000 | 200 | `campaign_won` |
| **Clean hands** (win with Integrity 70+) | 2,000 | 300 | `campaign_won: clean` |
| **Kingmaker** (run all four candidates) | 5,000 | 500 | `candidates_run: 4` |

**Daily tasks** (owner, Oct 29: specific, never generic).

A campaign task always names **who, where and why**, from the campaign's real state that day: the candidate, a
stakeholder waiting in the inbox, this week's fixed event, a weak place, a live scandal. It reads in the candidate's
voice or Lola's, like the satirical first-day tasks.

There is never a bare "Play your turn" or "Answer messages":
- **End Week** completes whichever task names this week's big moment.
- **Inbox tasks** name the person and what they want.

**Card length** (owner, Oct 29): every campaign task fits the task card.
- **Title:** at most 35 characters, one line on a phone where possible. It's the joke and the job.
- **Tag line:** at most 30 characters, in the card's meta line beside the goal tag. It's the why: a deadline, a
  number, a stakes word.
- **A "how" line** (owner, Oct 29, `taskHow`): every card also says the one action that does it ("👉 Book a tour stop
  in LIC", "👉 Reply to their message in the Inbox"). No hidden actions.
- **Tapping the task** opens the campaign right at that message, or the slot picker on a free slot with the action and
  place picked and marked "📌 Your task" (from the Tasks sheet too).
- **A candidate's own tasks** only use actions open every week (rally, tour stop, donor calls, rest), and the title
  says which: content/campaign/tasks.json is the current list.
- `validate:content` fails a title or tag line over its limit.

**Shared templates** (the variables come from the campaign):

| Title | Tag line | Done by | Built from |
|---|---|---|---|
| "Call {stakeholder} before they flip" | "⏰ {day} · eyeing the Mayor" | Replying to that message | An inbox Threat with the nearest deadline |
| "Win back {place}" | "📉 Down {n} points" | A tour stop booked there | The weakest place in the last poll |
| "Prep the {topic} answer" | "🎤 Debate {day}" | A prep slot on that topic | The fixed debate and an unprepped weak spot |
| "Meet {stakeholder} at {venue}" | "🕵️ Knows who funds his ads" | That task done | An open "Meet X at Y" task |
| "Kill the {scandal} story" | "🔥 Before the morning paper" | Answering the Exposure Event | A live Exposure Event |
| "Pay {staffer} before they quit" | "😤 Morale's tanking" | A bonus or fair-pay choice | A staffer with low Morale |
| "Crash the Mayor's {event}" | "📅 {day} · book across the street" | An event in the same slot | A known opponent event (with intel) |

**Candidate-only tasks:**

| Candidate | Title · tag line |
|---|---|
| **Goldcrest** | "Put Preston on a bus tour" (tour) ; "Find a donor without a yacht" (donor calls) ; "Get Preston to shake 50 hands" (rally) |
| **Castellano** | "Cut her rally speech to 4 minutes" (rally) ; "Get Ingrid a photo with a dog" (tour) ; "Pitch her 600-page plan to donors" (donor calls) |
| **Kowalczyk** | "Keep Frankie off the heckler" (rally) ; "Film Frankie on a tour stop" (tour) ; "Pack the union hall for Frankie" (rally) |
| **Starr** | "Approve Kaylee's tour-stop caption" (tour) ; "Pitch Free Wi-Fi to donors" (donor calls) ; "Give Kaylee a phone-free day" (rest) |

**How the tasks fill the day:**
- **The two goal-linked tasks** pick from the templates that serve the current campaign goal. "Win a debate" draws
  debate prep and a weak-spot meeting; "Make it to week 3" draws this week's most urgent inbox item and tour stop.
- **The random slot** can draw a candidate-only task.
- **Variety:** no template repeats two days running.
- **Rewards:** the usual daily-task rewards, never campaign cash.
- **Where the lines live:** `content/campaign/tasks.json`, checked by `validate:content`. The weekly content routine
  can draft extra variants for review in the Studio.

### 5.2 From Clout City into the campaign

| From the main game | Effect in the campaign |
|---|---|
| **The manager's clout** | Sets the candidate's starting rating and multiplies fundraising (a famous manager opens doors) |
| **Crew** | Crew members volunteer: a free Street Teams boost where they live (doubled for Kowalczyk) |
| **Bank balance (C$)** | The manager can seed the campaign from their own C$, up to a cap per act. After that, campaign cash and personal money stay separate |
| **Home neighborhood** | A starting bonus there |
| **Style lines and outfits** | A matching look at an event gives a small tour bonus (Business Casual at donor dinners) |

### 5.3 From the campaign back into Clout City

| From the campaign | Effect in the main game |
|---|---|
| **Wins at events, good poll ticks** | Clout, with the game's usual diminishing returns |
| **Scandals and Exposure Events** | A personal Tea card and a Lola News item (new: per-player items alongside the shared weekly gossip). A big scandal costs clout |
| **The election result** | A badge ("Ran a campaign for Mayor", "Made a Mayor", "Exposed") and a Collection card per ending |
| **Endorsements and allies** | Some stakeholders appear later as NPCs at places in the city |
| **Debts** | Unpaid campaign debts follow the manager as story beats, never as a drain on their C$ |

### 5.4 Money rules

- **All campaign money is C$.** Real money is never used in Campaign Mode: no buying Favors, campaign cash, Heat
  reduction or outcomes.
- **Shop pieces** can be worn at events but give nothing beyond the normal style-line bonus.

---

## 6. Situations and clear tradeoffs (core)

### 6.1 Situation cards

- **When:** 1 to 3 per week, during End Week, sometimes as urgent inbox messages.
- **What a card shows:** a one-line situation, an icon, and 2 to 4 choices.
- **What they're drawn from:** the place, the act, Heat, Integrity, recent ops, staff, the Mayor's moves and the
  candidate.

| Situation | Choices |
|---|---|
| A heatwave hits the day of your Bronx rally | Go ahead / Move indoors (C$) / Cancel and hand out water |
| A reporter ambushes your candidate about a donor | Answer honestly / Dodge / Blame a staffer |
| The subway is down and your volunteers are stranded | Pay for cabs (C$) / Cancel canvassing / Ask your crew for rides |
| Papa-Dani makes a promise your candidate agrees with | Praise him / Stay quiet / Call it a stunt |
| A staffer offers proof one of the Mayor's aides lied | Use it now / Verify first (costs a week) / Refuse to use it |
| Goldcrest: "Can I just buy the newspaper?" | Let him / Talk him down (Morale) / Leak that he asked |
| Starr wants to go live from the debate stage | Let her / Pull the phone (Morale) / Script it with her |

**Buying endorsements and votes** (owner, Oct 30: "some choices around buying allies/endorsements, buying votes"). Nine
cards in `content/campaign/situations.json`:
- **Endorsements:** Local 117's endorsement for a no-show job for Deb's nephew (`buy_union`), Auntie Joy's C$12,000 sound
  system (`buy_joy`), Lionel Chu's C$10,000 "menus" (`buy_lionel`) and Pastor Grant's roof (`buy_pastor`). A bought
  endorsement uses the choice effect `ally`, which puts that stakeholder on the campaign's side. One of the Mayor's allies
  bought this way leaves Poach Ally with one fewer target (the op says so when none are left).
- **Votes:** C$20 a vote from a precinct captain (`votes_cash`), sandwiches for "I Voted" photos (`votes_sandwich`), dead
  voters' absentee ballots (`votes_ghost`), a bus of out-of-town "residents" (`votes_bus`), and the Mayor's own C$20
  "pothole refunds" (`mayor_buys`: match him, film it, or rise above it).
- **How they play:** the bought option pays the most at once and leaves a heavy hidden trace (0.4 to 0.8), so Heat can bring
  it out later as an exposure. Most bought votes also have a hidden chance of going wrong on the spot. Every card has a clean
  option that costs something real. `?campaign=bribe` in the preview opens End Week on Joy's sound system and the C$20 votes.

### 6.2 Every choice explains itself

Before choosing, each option shows a plain-language preview:

| Part | Example |
|---|---|
| **You get** | "+2 Rating in the Bronx" |
| **It costs** | "C$4,000 and one evening slot" |

- **Icons plus words:** each meter has one icon and one color, always with a short word.
- **No risk labels or "may come back" hints** (owner, Oct 31, the Oct 30 rule for every card in the game): players learn
  from consequences. The odds, the traces and what comes back stay on the server.
- **Real costs in the preview:** what a choice certainly costs is always in "It costs"; what might happen later is a
  consequence to learn from, not a warning.
- **Short words:** "Heat" is explained the first time as "how close people are to finding out."

### 6.3 After the choice

- **Instant receipt:** "The rally went ahead. Attendance was low in the heat (-1 Rating), but the water stand got you
  on the local news (+2)."
- **Weekly recap:** the biggest causes at the poll tick.
- **When a delayed consequence lands,** it names the earlier choice: "Remember the donor you didn't return? He just
  tipped off the Mayor's people."
- **Consequence log** on HQ.

### 6.4 Design rules

- Every choice is a real tradeoff.
- At least one option is usually clean but costly, and one easy but risky.
- A choice is readable in under 5 seconds on a phone.

---

## 7. Reactive dialogue

Everyone sounds like they've been following the campaign.

| Who | Reacts to | Example |
|---|---|---|
| **The candidate** | The manager's calls, Integrity, polls | Castellano: "You booked me four rallies and no prep. I'll be charming. Probably." |
| **Stakeholders** | Promises kept or broken, Trust, favors | "You said you'd back our bill. Then your candidate went quiet at the debate." |
| **Journalists** | Public events, scandals, rumors at their Heat level | "People are asking where the donor money went." |
| **Campaign staff** | Ops, payroll, workload, Integrity | "I'll do it, but this is the second fake story this month." |
| **Papa-Dani** | Polls, attacks, debates (always warm) | "Three points in the Bronx! Congratulations, neighbor. I'm still filling potholes." |
| **City NPCs** | Big public moments | A barista: "Saw your candidate on the news. Looked tired." |
| **Lola** | Exposures, endorsements, charity, polls | "Our favorite campaign manager was spotted under a bridge at 11pm. Normal behavior." |

**What they know:**
- **Public:** anything everyone has seen.
- **Insider:** what people who were involved know.
- **Rumor:** journalists and gossips hint at things, and the hints grow with Heat.
- **Secrets stay secret:** an NPC never states something the manager hasn't been caught for. At high Heat, the rumors
  get closer to the truth, which works as a warning.

**How it's built:**
- **Line pools with condition tags** (`rating_up_borough`, `skimmed_detected`, `promise_broken:union_bill`,
  `heat>=50`, `candidate:goldcrest`), with variables and fallbacks.
- **Extra variants are drafted by the weekly content routine**, pass the same checks as News and gossip (invented
  names only, no real brands, no real officials) and go through the Studio before going live.
- **Lines are never generated live.**

**Data:** `npc_memory` and `dialogue_lines`.

---

## 8. Core model

| Name | Range | Purpose |
|---|---|---|
| **Candidate Rating** | 0 to 100 | The challenger's support |
| **Papa-Dani Rating** | 0 to 100 | The incumbent's support |
| **Campaign Cash (C$)** | 0+ | The campaign budget |
| **Favors** | 0+ | Shadow currency, earned mainly through meetings and tasks |
| **Heat** | 0 to 100 | Risk of discovery |
| **Integrity** | 0 to 100 | The campaign's moral standing. Starts at the candidate's value (Goldcrest 55, Starr 60, Kowalczyk 75, Castellano 85) |
| **Team Morale** | 0 to 100 | Scales the campaign's output |

- **The weekly poll tick** has a margin of error.
- **Places have their own priorities** (section 2.4), and neglecting a place lets the Mayor fill the gap.

**Gradual reveal:**

| When | What appears |
|---|---|
| Start | Both ratings, Campaign Cash, the calendar, Digital, Street and TV |
| First meeting | Favors and stakeholder Trust |
| First dirty offer | Heat, Integrity and the Ops screen |
| First hire | Team Morale and the team screen |
| Act 2 | Lead times, the map by place, the opponent calendar (with intel) |
| Act 3 | Lawsuits, defections, debts called in |

Meters that haven't appeared yet still run quietly in the background at neutral values.

---

## 9. Campaign systems

- **Campaign office:** holds the team and sets staff slots and rent. It is also the entity that can be sued.
- **Budget:** one pool of C$ across every channel, split each week.
- **Fundraising:** donor dinners, small-dollar drives and sponsors. The yield is multiplied by the manager's clout and the
  candidate's donor strength. Each source has strings attached.
- **Digital:** cheap, fast and volatile. It is the home of bots and leaks.
- **Street Teams:** canvassing, rallies, block captains. Slow and durable, and resilient to scandal.
- **TV and Radio:** expensive, broad and swingy. Positive spots or attack ads. Attacks lower the Mayor faster but cost
  likability.
- **City Tour:** stops on a limited calendar. A strong speech lifts a place; a gaffe tanks it.

| Decision | Candidate | Papa-Dani | Notes |
|---|---|---|---|
| Positive spend | Steady rise | None | Slow, safe |
| Attack spend | Small dip | Fast drop | Triggers counterattacks |
| Neglect a place | Drift down | Drift up | He fills the gap |
| Dark op | Varies | Fast drop | Adds Heat, lowers Integrity |

---

## 10. The campaign team

**Roles:** a starting team of 4, growing with office upgrades.
- Campaign Manager's Deputy (the player is the manager)
- Pollster
- Comms Director
- Field Organizer
- Finance Director
- Fixer
- Legal Counsel
- Scheduler

**Stats in the test build:** Competence, Morale and Loyalty. Salaries are fixed. Stamina, Traits and Skeletons
come later.

**Team budget:** payroll, bonuses, perks, office rent and an optional legal retainer (an optional gamble).

**Team events:**
- Poached by the Mayor's machine
- Sick or burned out
- Resigns
- Leaks
- Defects (later)
- A skeleton surfaces (later)

**How often dirty play causes team trouble (starting rates):**
- **Warn first, punish second:** a grumbling line, then a warning card, then the event. The first dark op of each
  campaign only ever produces a warning.
- **Clean success:** about 10% chance of a team event.
- **Success with a trace:** about 20%.
- **Blown:** a team event is guaranteed.
- **Each extra dark op in the same act** adds about 5%.
- **What lowers the odds:** high Loyalty and Morale, a skilled Fixer, cut-outs, bonuses. Underpaying raises them.
- **At most one team event from dirty play per week,** and the receipt always names the cause.

**Lawsuits:**
- **Case types:** defamation, campaign finance, labor, vendor.
- **Responses:** Settle, Fight, Countersue, Ignore.
- **In the test build:** one lawsuit.
- **Later:** arrests, which follow only a Blown op or a debunked fabrication, never random chance.

---

## 11. Dirty money and budget dilemmas

### 11.1 Dirty offers

Suspect characters approach the campaign with offers that solve a real problem now. Which offers appear depends on
Integrity and the candidate.

| Offer | Upside | Hidden cost |
|---|---|---|
| Anonymous donor, cash donations | A big C$ boost | Exposure risk; the donor calls in a favor later |
| A fixer offers a file on the Mayor's machine | A fast drop for him | May be fake; an Integrity hit if it is |
| A bot network for Digital | Cheap, huge reach | Can be flagged, and Digital credibility collapses |
| A sponsor with a shady client list | Ongoing funding | Demands favors or staffing in Act 3 |

Dirty money is faster but expires. Clean money is slower and never blows up. Some suspects are honest, and some "good"
donors have motives.

### 11.2 Budget dilemmas

| Dilemma | Choices | Upside | Cost or risk |
|---|---|---|---|
| **Divert funds to your account** | Skim a little, skim a lot, leave it | Campaign C$ moves into the manager's **own Clout City bank** | Integrity -6 or -12, a finance trace, lawsuit risk; repeated skimming stacks the trace weight |
| **Donate to charity** | Publicly, anonymously, don't | Public: +2 Rating there and a news beat. Anonymous: Integrity +5 and a loyal ally | Costs C$; a public donation right before a poll can be called a stunt |
| **Return a dirty donation** | Return it, keep it | Integrity +6, the debt is removed | Loses the C$; the donor may tip off the Mayor's people |
| **Campaign perks** | Car service, office party, frugal | Morale up, faster travel | Integrity -3, and a "lavish spending" story above Heat 25 |
| **Pay staff fairly** | Pay the bonus, delay it, skip it | Morale and Loyalty | Skipping raises labor-claim and leak risk |
| **Vendor kickback** | Accept, decline | A rebate to the campaign or the manager | Integrity -8, a trace, lawsuit risk |
| **Help a constituent** | Cover a family's rent, refer them elsewhere | Integrity +4, a story that may go viral | Costs C$; a grey area |

**Rules:**
- **The temptation is real:** skimmed C$ genuinely helps the manager's main-game life. It is capped (section 15).
- **Traces surface late:** skims and kickbacks create traces under the same discovery rules as ops (section 13.4).
- **Exposure takes the money back:** the manager repays from campaign cash first, then their own C$, on top of the
  scandal.
- **Good choices pay off slowly:** they raise Integrity, build loyal allies and unlock the clean endings.

---

## 12. Stakeholders: inbox, meetings and tasks

The main way to earn Favors, intel and allies. The manager has to show up in person.

**Inbox:**

| Message type | Example | Choices |
|---|---|---|
| Invite | "Dinner Thursday. Bring your pollster." | Accept, decline, send a staffer |
| Request | A union head wants a stance on a bill | Promise, hedge, refuse |
| Tip | A journalist hints at a story on the Mayor's machine | Follow up, trade, ignore |
| Threat | A donor warns they'll defect | Appease, call the bluff, counter-offer |
| Anonymous | "Under the bridge, 11pm. Come alone." | Go, send a cut-out, report it |

- **Reply tone:** warm, formal, noncommittal or pressure.
- **Messages expire.**
- **Every message carries a trust label;** anonymous tips can be real, fake or a trap.

**Stakeholders:** donors, union heads, borough bosses, journalists, community and faith leaders, academics, fixers, and
aides of the Mayor who might switch sides.
- Each has **Trust** and **Leverage** meters, plus wants, fears and a price.
- Each starts warm or cold depending on the candidate (section 2.4).
- All are fictional.

**Venues:**
- **Fictional places,** or real public landmarks only (bridges, parks, waterfronts).
- **Tiers:**
  - **Public:** low Heat risk, clean Favors.
  - **Semi-private:** medium risk, better intel.
  - **Shadow:** high risk, dirty Favors and big debts.
- Semi-private and shadow meetings can be photographed or tailed, leaving a trace. A cut-out lowers both the risk and
  the reward.

**Tasks ("Meet X at Y"):**
- Each task card shows: Giver, Objective, Location, Time window, Prerequisite, Reveal, Reward, Risk.
- Intel unlocks op targets, weak places and counters. Intel can be false.

**Favors:**
- **Earned** through meetings and tasks.
- **Provenance:** each is tagged clean or dirty. Dirty Favors spent on dirty ops compound Heat.
- **Called in:** stakeholders can call in what they're owed in later acts.
- **Expiry:** clean Favors expire at the end of the next act, dirty ones at the end of their own act.
- **Trading** Favors between players (owner, v0.4) waits until after the test build: it turns a solo mode into a
  market that side accounts could abuse.
- **Never bought with real money.**

---

## 13. Shadow Ops

### 13.1 What ops target

Ops target **Papa-Dani's campaign machine**: his fictional aides, events, donors and endorsers. Never his
character's private life, never real people or organizations. They are abstract, stylized text beats with no
realistic how-to detail.

### 13.2 Heat

| Heat | State | Effect |
|---|---|---|
| 0 to 24 | Quiet | No extra risk |
| 25 to 49 | Sniffing | Journalists dig; +10% detection on every trace |
| 50 to 74 | Investigation | One Exposure Event can trigger a week |
| 75+ | Boiling | A forced scandal at the next tick |

- **Decay:** Heat drops 5 a week.
- **Exposure Events per act:** 1 to 2, capped at 2.

### 13.3 Resolution and starter ops

**Success chance** = base + Fixer bonus + deniability bonus - target defense, with candidate modifiers (section 2.2).

| Outcome | Result |
|---|---|
| Clean success | Full effect |
| Success with trace | Full effect; a trace is logged |
| Fail | No effect; Heat +50% of normal |
| Blown | No effect; Heat +20, staff Loyalty -10, an immediate news beat |

**Deniability:**
- **Direct:** full control, no bonus.
- **Cut-out:** +50% cost, -30% detection, and a 20% chance the op goes off-script.

| Op | Cost | Base success | Effect | Heat / Integrity | Backfire |
|---|---|---|---|---|---|
| **Fake News** | 1 Favor + C$5,000 | 70% | Mayor -3 in a place, -1 citywide | +8 / -5 | 35% fact-check chance over 2 weeks; if debunked: Candidate -4, Integrity -8, Heat +15 |
| **Poach Ally** | C$15,000 or 3 Favors | 60% | One of his donors or endorsers switches: Candidate +2, Mayor -2, plus a funding stream | +6 / -4 | 25% chance the ally double-crosses you in Act 3 |
| **Sabotage** (later, needs the opponent calendar) | 2 Favors + C$8,000 | 55% | His scheduled event fails | +12 / -8 | On Blown, a staffer is exposed |

**Later ops:** Bribery, Plant a Mole, Smear Dossier.

### 13.4 Evidence traces

- **What a trace is:** `{type, weight, week_created}`.
- **Weekly discovery chance:** Heat / 100 × weight.
- **Decay:** the weight drops 10% a week, and traces persist across acts.
- **When a trace is discovered:** an Exposure Event. The manager chooses Deny, Blame a cut-out, Confess or
  Counter-leak. It also becomes a personal Tea card and News item.

### 13.5 The Mayor's machine fights back

- **Under Attack alert:** the manager chooses Counter, Absorb, Retaliate, or Expose (Expose needs evidence).
- **A cleaner campaign faces a cleaner machine.** An escalating one faces all-out war.
- **Papa-Dani himself stays warm** and can look shocked when one of his aides is caught.

---

## 14. Debates, Election Day and endings

### 14.1 Debates

- **Prep:** in the weeks before a debate, prep slots each cover one topic:
  - a local issue;
  - the Mayor's weak spots (from intel);
  - the candidate's own vulnerabilities.
- **The debate:** 4 rounds in the test build, 5 or 6 later. The manager calls the play from the wings each round:
  Facts, Charm, Attack, Deflect or Own it.
  - Each play uses the "You get / It costs / Risk" preview.
  - The candidate changes the odds: Castellano's Facts, Starr's Charm, Kowalczyk's Own it, Goldcrest's Attack.
  - A candidate can ignore a bad call and go off-script.
- **Crowd meter** after every answer.
- **Lying is checked the following week,** under the Fake News rules.
- **Afterwards:** a snap poll, Lola's write-up, NPC reactions and a receipt.

### 14.2 Election Day

- **Last calls:**
  - get out the vote, where Street Teams and crew volunteers matter most;
  - one last dirty play, at High risk;
  - one Election Day situation card.
- **The result:**
  - each place votes from both ratings, turnout and random variation inside the margin of error;
  - places are weighted by population;
  - a recount if the margin is under 1% (later).
- **Election night:** results arrive place by place, with Lola live, staff and the candidate reacting, and Papa-Dani's
  call. He concedes graciously, or wins graciously.

### 14.3 Endings

| Ending | When |
|---|---|
| **Clean win** | Win with Integrity 70+ and no live traces |
| **Dirty win** | Win with low Integrity or live traces; a reckoning follows (later) and can turn into **Exposed** |
| **Honorable loss** | Lose with Integrity 70+ |
| **Mayor survives stronger** | Lose after heavy attacks or dark ops (later) |
| **Exposed** | A major scandal breaks before the polls close |

The test build ships three endings: clean win, dirty win and loss.

### 14.4 Rewards in the main game

- **Clout,** the most for a win.
- **A badge** per ending.
- **A Collection card** per candidate and ending.
- **Lasting NPC reactions.**

**Clout penalties:**
- **Losing:** a small dip (proposed: up to 5% of what the campaign earned), so trying never feels like a mistake.
- **Exposed:** a real cost (proposed: whatever the campaign earned, plus a fixed amount).

**If the candidate wins:**
- **In the run:** they become "Mayor-elect" in that manager's campaign, with cosmetic perks only (the City Hall visit, a
  victory poster at home).
- **Papa-Dani stays the city's mayor for everyone,** because the shared city can't change hands per player. He shows
  up in News as "Mayor (for now, in some timelines)."

---

## 15. Server rules, fairness and the economy

- **Every roll happens on the server,** the same principle as Lucky Star Lotto. That covers op success, trace
  discovery, poll noise, situation outcomes, debate rounds, team events and the election. The browser only sends the
  manager's choice and never a result.
- **End Week is a server function,** once per real New York day.
- **Rate limits:** End Week, op launches, budget moves and inbox replies join the existing buckets in game_settings
  'rate_limits'.
- **Ledger:** every C$ and clout movement between the main game and a campaign writes a `ledger` row:
  - seeding: 'campaign_seed';
  - skimming: 'campaign_skim';
  - repaying a discovered skim: 'campaign_repay';
  - rewards: 'campaign_reward'.
- **Caps (proposed), so campaigns can't be farmed:**
  - **Seeding:** up to C$1,000 of the manager's own money per act.
  - **Skimming:** at most 10% of the campaign's raised C$, and no more than C$1,500 per campaign.
  - **Overlap:** one campaign running at a time.
  - **Replays:** a new campaign at most once every 7 days. Clout rewards halve for a candidate already won with.
- **Real money:** nothing in this mode reads or writes real-money purchases.
- **Settings:** the numbers live in game_settings 'campaign', mirrored by lib/campaign.ts and checked by
  tests/campaign.test.ts, like the other features.

---

## 16. Data model (Supabase sketch)

- `campaigns` (id, player_id, candidate, act, week, status, unlocked_meters, last_end_week_on)
- `campaign_meters` (campaign_id, cash_cs, favors, heat, integrity, rating, morale)
- `campaign_links` (campaign_id, starting_clout, seeded_cs, crew_volunteers, home_place)
- `incumbent_state` (campaign_id, rating, place_ratings)
- `calendar_events` (id, campaign_id, type, owner, place, day, slot, status, visible)
- `staff` (id, campaign_id, role, competence, morale, loyalty, salary_cs, status)
- `team_events` (id, campaign_id, staff_id, type, cause, week)
- `legal_cases` (id, campaign_id, case_type, trigger_id, response, cost_cs, status)
- `shadow_ops` (id, campaign_id, op_type, deniability, outcome, week)
- `op_traces` (id, campaign_id, source_id, weight, discovered, week_created)
- `offers` (id, campaign_id, type, accepted, debt_due_act)
- `budget_choices` (id, campaign_id, dilemma, choice, amount_cs, to_personal, week, trace_id)
- `stakeholders` (id, name, type, wants, fears) and `campaign_stakeholders` (campaign_id, stakeholder_id, trust, leverage)
- `inbox_messages` (id, campaign_id, stakeholder_id, type, trust_label, deadline, reply_tone, status)
- `tasks` (id, campaign_id, giver_id, place, venue_tier, window, reveal, reward, risk, status)
- `favor_ledger` (id, campaign_id, stakeholder_id, provenance, owed_direction, called_in_act)
- `situations` (id, campaign_id, card_id, choice, week)
- `npc_memory`, `dialogue_lines`
- `debates` (id, campaign_id, week, prep, rounds, crowd_score, result)
- `election_results` (id, campaign_id, place, candidate_share, mayor_share, turnout, ending)

Content (candidates, situation cards, offers, stakeholders, lines) lives in `content/campaign/*.json`, checked by
`validate:content`.

---

## 17. Content and shipping guardrails

- **Everyone is fictional:** stakeholders, staff, venues, the candidates and every character. No real parties, outlets,
  businesses or officials.
- **No real-world ideology:** the platforms are satirical takes on city problems (rent, transit, floods,
  nightlife), never party politics, and no candidate is coded as a real party.
- **Papa-Dani is the friendly incumbent:**
  - his voice rules are in docs/CAST.md;
  - ops hit his machine, never his character;
  - he is sometimes right.
- **Rating target:** "mature themes, fictional crime" for iOS and Android. The game is already 18+.
- **Fiction disclaimer** on the mode's start screen.
- **Marketing** shows gameplay and fictional characters only, never comparisons to real politicians.

### Mayor character: owner decision and risk

- **Decision:** the incumbent stays Mayor Papa-Dani (owner, Oct 29).
- **Known risk:** the name resembles New York City's real mayor, who previously represented Astoria, the game's
  starting neighborhood. A mode built around fake news and smears against an incumbent could be read as targeting
  him. That can affect app-store review, ad platforms (including TikTok promotion) and press coverage.
- **Safeguards:**
  - Papa-Dani stays warm and is never the target of personal attacks;
  - ops hit only his fictional machine;
  - his backstory, look, voice and record are invented (potholes and ribbons, no real positions);
  - there are no real logos, offices, slogans or likenesses;
  - the disclaimer.
- **Review:** revisit this before the mode's public launch, based on store review and legal advice.

---

## 18. Scope

### Test build (the first version)

- **Campaign:** 4 campaign weeks in one borough (Queens), one per real day.
- **Candidates:** all four, each with their bio, platform, starting meters, stakeholder map and lines.
- **The weekly turn:**
  - Inbox, budget split (Digital, Street, TV, payroll), End Week, and the next morning's newspaper recap.
  - Calendar with 10 slots and 2 fixed events (a gala and a debate).
- **Situation cards:** 8 shared ones plus 2 per candidate, with the preview, receipt and recap.
- **Inbox:** 6 messages, the 3 venue tiers and 4 "Meet X at Y" tasks.
- **Shadow layer:** Fake News and Poach Ally, with Heat, Integrity and hidden traces. Two dirty offers that feed Favors.
- **Money dilemmas:** divert funds to your account (capped) and donate to charity.
- **Team:** 4 staff with Competence, Morale and Loyalty, one poach event and one lawsuit.
- **Debate:** 4 rounds.
- **Election:** a simple election and three endings, with badges, clout and a Lola News item.
- **The gradual reveal.**
- **Main-game links:**
  - the manager's clout;
  - crew volunteers;
  - seeding;
  - clout for wins;
  - scandals as personal Tea cards.
- **Unlock** at Rank 2, with the teasers (News card, teaser sheet, Rank 2 reveal line, locked app, Lola's tip,
  posters).
- **Goals and tasks:** the seven campaign goals and the campaign daily tasks.
- **In the preview:** `/preview/home?campaign=pick|week|situation|debate|election` (sample data).
- **First success metric:** do testers take a second dirty op after seeing their first trace?
- **Second metric:** do testers come back for week 3?

### Later

- **Campaign shape:** the full 8 weeks and four acts, more places, lead times and the opponent calendar.
- **Ops:** Sabotage, then Bribery, Plant a Mole and Smear Dossier.
- **Team:** Stamina, Traits and Skeletons; arrests and defections.
- **Endings:** the reckoning, recounts and the full set of endings; New Game+.
- **Social:** Favor trading.
- **Roles:** Fixer and Defender.
- **City layer:** the async city, ghost rivals and weekly city beats.

---

## 19. Decisions and open questions

### Decided

| Question | Decision |
|---|---|
| Who is the incumbent? | Mayor Papa-Dani, the friendly mayor (owner, Oct 29) |
| Who does the player play? | The campaign manager (owner, Oct 29) |
| Which candidates? | Goldcrest, Castellano, Kowalczyk, Starr (owner, Oct 29) |
| Currency | C$ only; real money is never used in this mode |
| Favors expire? | Yes: clean ones at the end of the next act, dirty ones at the end of their act |
| Favor trading | Yes, but after the test build |
| Exposure Events per act | 1 to 2, capped at 2 |
| Former staff return? | Yes, as allies or enemies (later) |
| Legal retainer | Optional |
| Skip a week? | Yes, with consequences |
| Meetings a week | 3 |
| Venues | Fictional, or real public landmarks only |
| Frankie Kowalczyk | A man (owner, Oct 29) |
| Unlock | Rank 2, not Rank 3, with "Upcoming election" teasers before it (owner, Oct 29) |
| Goals | Campaign goals on the ladder (owner, Oct 29) |

### Proposed, to confirm

- **The test build** is 4 campaign weeks. The full campaign is 8.
- **Caps:**
  - seeding C$1,000 per act;
  - skimming at most 10% and C$1,500 per campaign;
  - one campaign at a time, a new one at most every 7 days.
- **Losing** costs a little clout. **Exposed** costs what the campaign earned, plus a fixed amount.
- **A won campaign** makes the candidate "Mayor-elect" in that manager's run only. Papa-Dani stays the city's mayor
  for everyone.

### Still open

- **Content per week:** how many cards, messages and tasks keep a campaign spread over several sessions.
- **Team trouble rate:** whether the rate after dirty play feels fair (starting rates in section 10).
- **Help for the underdog:** whether low-clout managers get a mentor stakeholder so their first campaign is
  winnable.


## Reputation: the manager and the candidate (owner, Oct 31: option C)

The candidate's Integrity (on screen in Campaign HQ) and the player's own private Halo ↔ Hustler meter stay two meters,
but they're linked (lib/campaign.ts `CAMPAIGN.rep`, migration 0142):

- **Going in:** a Halo manager (meter 70+) starts the candidate 5 Integrity cleaner; a Hustler manager (30 or less) starts
  them 5 dirtier and hears the anonymous offers a week early. A manager whose meter hasn't been revealed yet starts even.
- **Coming out:** each End Week moves the manager's meter by half of how far the candidate's Integrity moved that week,
  both ways: at most ±8 a week and ±15 a campaign. The week's recap says so in one line ("😇 Running it straight is
  rubbing off on you." / "💸 The campaign's habits are rubbing off on you."), never with the number.
- In 30 simulated campaigns each, clean play ended +6 to +14 toward Halo and dirty play about −15 toward Hustler.
- Heat, traces and Street Rep stay inside Campaign Mode until the underworld (Pablo) gives them somewhere to go.

## The manager's background (owner, Oct 31: careers and aspirations)

- **Aspiration** (migration 0143): a Public Servant's campaigns start 3 points up across the city.
- **Job** (Careers part 3; `StartInput.career`, `CAMPAIGN.background`): a manager with a job when the campaign starts gets one
  line in week 1's receipts and one edge: Hospitality's staff start 10 morale happier, Tech's startup contacts make
  fundraising pay a fifth more, Media's familiar face is worth 2 points across the city, and City Hall (migration 0144) knows the
  Mayor's playbook: 1 point up, 2 from Policy Aide. A City Hall employee running a campaign may meet the Mayor at their desk
  (career task `cityhall-conflict`).
