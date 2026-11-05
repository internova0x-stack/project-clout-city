# The Homecoming race ("Big Man on Campus" / "Queen Bee")

Owner decisions, Nov 4: "around being the big man/woman on campus… schooling as a balancing act that creates tension/tradeoffs";
"go with your recommendations" (4 real weeks, the race against the cast only, other players never rivals); "Keep it to male and
female"; "Gender is already picked so players shouldn't have to choose"; "Hanging out should add significantly to popularity
but affect GPA negatively". Approved preview: the "Big Name on Campus" artifact.

## The story

St. Johnsons has crowned the same Homecoming King and Queen three years running: **Chad Wellington III** ("three crowns, zero
books", his dad's name is on the library) and **Marisol Vega** ("three crowns and a podcast"). You just transferred in. Nobody
knows your name. You have one semester to change that.

**The goal:** be crowned at Homecoming without failing out. **The crown follows the gender chosen in the character creator**
(`modelSex(look)`): a female character runs for Homecoming Queen against Marisol, a male character for King against Chad.
The top tier says it: Queen Bee / Big Man on Campus; the one below, It Girl / It Person.

## How it starts

1. **Enrol** (the campus card, as today): classes, the dorm, dining, party nights. Plain school life, nothing more.
2. **Meet the rival:** the first time a student walks onto the Quad, the reigning royal makes an entrance (a takeover card:
   their portrait and line, the two student IDs, "Nobody" against "Queen Bee", Lola's line, Not now / Run against her).
3. **Declare for the crown** (Crown HQ's start screen): the four weeks, "Running for Homecoming Queen · Your rival: Marisol",
   the rules (keep a 2.5 GPA, your job goes part-time), **I'm running**. The semester starts the next Monday.
   One race at a time; **not while a city campaign runs** (and no campaign while a race runs: both are full-time).
   **Your job goes part-time** (owner, Nov 4: "build it"): while a race runs, a career job allows `CAREER.partTime.days` (2)
   workdays a week, pays for the days worked, and the review judges the part-time week (1 day is the least it accepts);
   level and coworkers stay (`CareerCtx.partTime`, read from `school_races` by careerActions; `?career=parttime`).

## The four weeks

| Week | Act | What happens |
|---|---|---|
| 1 | The New Kid | You're a Nobody. Meet the squad and the cliques. The rival notices you, barely. |
| 2 | Rush Week | Greek Row opens. The first midterm. The leaked answers and the Thursday rager. |
| 3 | The Scandal | The rival fights back; a secret about them; the noise complaint. |
| 4 | Homecoming | Finals week. Saturday night: the votes, clique by clique. |

## A week

- **The planner:** 7 days × a day and a night slot. Tap a slot, pick from Class, Study, Party, Club, Work shift, Hang out, Date,
  Sleep (Club needs a club, Date a crush or partner, Work a job). Each New York day plays its two slots (catch-up on read).
  Party and Hang out are where Rep comes from; Hang out is cheap on Energy but costs GPA. A party the night before Friday's
  exam costs GPA on top. Low Energy halves what class and study give and cuts Rep gains. A day with nothing social fades Rep.
- **Friday:** the exam swings GPA by how much you studied and slept; the **verdict** (a results card): the week's Rep, GPA
  against the 2.5 line, what you keep. Under the line is a strike (the careers ladder: a warning, then probation).
- **Clashes and tough choices** (the Moral Choices card, no risk labels): the rager the night before the midterm, the leaked
  answers, the rival's secret, the noise complaint, your mom's call. Some come back later ("It came back"): the Dean finds the
  answer key (off the ballot), the Honor Code newsletter, the rival's deal for your silence, your mom at Homecoming.
- **The Dean** keeps a hidden heat; at 60 a hearing takes you off the ballot until it's cleared.

## Crown HQ (the Phone app)

Campaign HQ's layout: your face and standing, **Crown funds** (your bank), the GPA / Rep / Energy meters, then
**Week** (the planner) · **Inbox** (texts from the rival, the squad, Trey, the Dean, your mom; replies cost something) ·
**Squad** (Priya the study partner, Marco the party promoter, Dee the photographer, Tobi the freshman fan: morale and loyalty;
Priya leaves if you cheat twice, Tobi joins the rival if you ignore him) · **Allies** (the five cliques, hostile to ride-or-die:
Greek Row, Theater Kids, Finance Club, Athletes, Influencers) · **Budget** (party, the look, "Vote You" merch, a tutor, squad
pay, in C$50 steps; paid at the week's end; real money never).

## Homecoming

Saturday of week 4, election-night style: each clique votes by your standing with it and your Rep against the rival's. You
must be eligible (GPA 2.5+, no open hearing). Endings: **crowned** (a legend, a 👑, badge homecoming-king/queen), **crowned,
under a cloud** (dirty: bought votes or Dean heat), **runner-up** (N votes short, what you keep), **off the ballot**.

## Code

- `lib/schoolRace.ts`: the pure engine (`startRace`, `setSlot`, `setBudget`, `choose`, `reply`, `refresh`, `raceView`;
  `RACE` holds the numbers). `content/school/race.json`: cliques, squad, rivals, people, cards, inbox; `{rival}` is filled
  with the rival's first name. Server and preview only (`lib/schoolContent.ts`).
- Server: `app/home/schoolActions.ts` (crypto random source, service role), migration 0162 (`school_races`, `school_begin`,
  `school_save`, ledger kinds school_cash, school_spend, school_mood, school_meter, school_week, school_crown; rate bucket
  'school'). Preview: `lib/schoolSim.ts`, `?school=…`. UI: `components/school/`.
- Tuning: `tests/schoolRace.test.ts` plays whole semesters: partying every night loses the ballot, grinding stays a Nobody,
  a balanced semester wins some of the time, using the leaked answers usually comes back.
