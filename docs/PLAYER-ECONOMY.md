# Clout City: Player Economy

**Status:** Draft v0.1. All limits, fees and thresholds are placeholders to tune with analytics. **Related specs:** Frameworks Map (Economy 6, Relationships 13, Analytics 21). Campaign Mode (v0.4). Clout City Pablo. Jobs and Careers. Moral Choices System. Shop Manager.

---

## 1. What this adds

Players can exchange value with each other in four ways:

| Feature | Summary |
| --- | --- |
| **Gifting** | Buy a Shop item for another player |
| **Player jobs** | Post a job for other players, with payment held in escrow until the game verifies the work |
| **Item marketplace** | Trade and sell items to other players |
| **Business and property sales** | Sell a business or property to another player |

**Not included, by decision:** sending C$ directly to another player, including tips. Every exchange is tied to an item, a job, or an asset, so value never moves as free cash.

**Why:** a player economy makes the city feel alive, gives players reasons to depend on each other, and creates endless content from players themselves. The guardrails below exist because it is also the system most likely to be exploited (real-money trading, alt-account farming, leaderboard manipulation, scams).

---

## 2. Core rules (apply to every feature)

| Rule | Detail |
| --- | --- |
| **No direct C$ transfers** | Value only moves as an item, a job payment, or an asset sale |
| **Real-money items are never tradable or giftable** | Clout Couture and anything bought with $ stays bound to the buyer (as already decided). Story side arcs, event tickets and postcards are also bound |
| **Escrow for everything** | The game holds the C$ or item and releases it only when both sides have confirmed, or the work is verified |
| **Unlock requirements** | Trading features unlock only after a minimum account age (placeholder: 14 days) and a minimum clout level, to stop alt-account farming |
| **Weekly limits** | Caps on the total value each player can send and receive per week across all features (placeholder: tied to their own weekly earnings) |
| **Fees as a money sink** | A fee on marketplace sales, job payments and asset sales (placeholder: 5 to 10%), removed from the economy to control inflation |
| **Price bands** | Items and assets can only trade within a range around their reference value (placeholder: 50% to 150% of Shop or appraised value), so trades can't hide money transfers |
| **Leaderboard fairness** | Net worth counts traded and gifted items at their **Shop value**, not the price paid. C$ earned from player jobs and sales counts toward net worth only up to a weekly cap |
| **Friends and crew by default** | Unsolicited trade or job offers from strangers are off by default; players can opt in to the open marketplace and public job board |
| **Full history** | Every trade, gift, job and sale is logged and visible to both players |
| **Block and report** | On every trade, gift, job and listing |
| **No cash-out** | C$ and items can never be converted to real money through the game |

---

## 3. Gifting

- A player buys a **Shop item** (C$ items only) and chooses a friend or crew member to receive it, with an optional short message.
- The recipient can **accept** or **decline** (declined gifts return to the giver as the item).
- **Limits:** a weekly cap on the number and total value of gifts sent and received; gifts only to friends or crew members of at least a few days.
- **No regifting or reselling** a received gift for a set period (placeholder: 14 days), to stop gifts being used to move value.
- **Net worth:** a gifted item counts at Shop value for the recipient, and is removed from the giver's.
- Gifts can appear as a small social moment ("Jordan sent you a jacket"), and in Lola's gossip for big gestures.

---

## 4. Player jobs

Players can hire other players for tasks the game can verify.

### 4.1 How it works

| Step | What happens |
| --- | --- |
| 1. Post | The employer picks a job type, the pay in C$ and a deadline. The pay is **taken into escrow** immediately |
| 2. Accept | Another player accepts (from friends and crew, or the public job board if opted in) |
| 3. Do the work | The worker completes the job through normal gameplay |
| 4. Verify | The game checks completion automatically |
| 5. Pay | Escrow releases the pay, minus the fee. If the deadline passes, the employer gets a refund |

### 4.2 Job types (game-verifiable only)

| Job type | Example | Verified by |
| --- | --- | --- |
| **Campaign help** | Run 3 street team shifts in Astoria for my campaign | Campaign Mode actions logged for that campaign |
| **Event support** | Attend and hype my club night | Presence at the event during its time |
| **Business shifts** | Work 2 shifts at my café | Shifts logged at that business |
| **Errands** | Visit 3 places and check in for my hunt team | Check-ins at those places |
| **Crew goals** | Help complete a crew goal | Goal progress from that player |
| **Interior decoration** | Decorate my apartment in a cozy style, with a C$ budget for furniture | The decorator places items in the client's home using the client's budget; the client approves the result (4.4) |
| **Event planning** | Plan my birthday party: book a venue, pick a theme, invite at least 15 guests | The event is created with the agreed venue and theme, and the guest target is reached |
| **Driver** | Drive me from Astoria to my date in SoHo by 8pm | The trip is completed in the travel system, on time, using the driver's car |
| **Underworld jobs** (Pablo, phase 2) | Move money or broker a deal for my scheme, targeting NPCs | The job completed in the Pablo system |

**Not allowed:** jobs that can't be verified by the game or by the approval-based rules in 4.4 (they invite scams), and jobs that target real players for harm. Sabotage and smear jobs only ever target NPCs, or opt-in competitive spaces such as a rival's campaign within Campaign Mode's own rules.

### 4.3 Guardrails

- **Pay limits** per job and per week, within the core weekly limits.
- **Ratings:** employers and workers rate each other; low ratings reduce visibility on the job board.
- **Abuse flags:** a worker paid repeatedly by one employer for trivial jobs is flagged as a possible money transfer.
- **Moral layer:** underworld jobs between players raise Heat for both, as in the Pablo spec.

### 4.4 New job types in detail

**Interior decoration**

- The client grants the decorator **temporary edit access** to their home for the job's duration, and sets a **furniture budget** in C$ (held in escrow with the fee).
- The decorator buys items from the Shop with that budget, delivered straight to the client's home, and arranges them. Items always belong to the client; the decorator never receives them.
- Because style is subjective, this is an **approval-based job:** the client approves the result to release payment. If the client neither approves nor requests changes by the deadline, payment releases automatically. One round of changes is included.
- **Disputes:** a client who rejects finished work can't keep the items without paying; disputes go to the Story Studio review queue, and repeated rejections lower the client's rating.
- **Links:** decorators build a portfolio (photos of finished rooms on their profile); a high-rated decorator can grow it into a career or a business. Decorating a home with Shop items can also feed a design skill, if one exists.

**Event planning**

- The planner organizes another player's event: books a venue, sets a theme and invites guests, using the client's budget for venue costs.
- Payment releases when the event is created as agreed and reaches the guest target. A bonus can be set for exceeding it.
- **Links:** works with Venues and events (the venue booking), Relationships (guest lists from crew and friends), and Campaign Mode (rallies and fundraisers planned by players).

**Driver**

- A player who **owns a car** can drive another player between places. The client travels on the driver's car instead of taking a taxi or the subway.
- Payment releases when the trip is completed in the travel system on time. Lateness reduces the rating.
- **Value for the client:** cheaper than a taxi, faster than the subway, and arriving in a nice car adds a small clout bonus at some places (a party, a date).
- **Links:** gives cars a use beyond net worth; ties to Pablo's "move money" service (a driver specialist), and can become a gig for NPC clients too.

**Shared guardrails for these jobs:** the same escrow, fees, weekly limits and ratings as other jobs (4.3); edit access and car trips end automatically when the job ends; and nothing about these jobs can target a player for harm.

---

## 5. Item marketplace

### 5.1 How it works

- Players **list** a tradable item for C$ or **offer a swap** (item for item, with optional C$ to balance).
- **Listings** are visible to friends and crew, or to everyone for players opted in to the open marketplace.
- **The trade window:** both players see the exact items and C$ side by side and confirm at the same time. Big trades need a second confirmation.
- **Escrow** holds both sides until both confirm.

### 5.2 What's tradable

- **Tradable:** C$ Shop items (fashion, home items, cars, accessories) after a short holding period from purchase.
- **Not tradable:** real-money items, story side arcs, event tickets, postcards, items received as gifts within the no-resale period, and quest or story items.

### 5.3 Guardrails specific to trading

| Risk | Guardrail |
| --- | --- |
| Disguised money transfers | Price bands around Shop value; swaps must balance within the band |
| Real-money trading | Weekly limits, account age, price bands, and banning accounts found selling items for real money |
| Scams | The two-sided trade window with escrow; no trades outside the window |
| Account theft | A trade hold after a new device, password change or email change, plus notifications and a report-and-reverse window |
| Duplication bugs | Every trade validated on the server; unique item IDs; the ability to roll back |
| Market manipulation | Limits on how many of one item a player can buy per week; the Shop keeps regular items in supply |
| Economy distortion | The marketplace fee as a money sink; resale to the game stays at 60% |

---

## 6. Business and property sales

- Players can sell a **business** or **property** to another player.
- **Appraisal:** the game sets a reference value from purchase price, upgrades, revenue and the neighborhood; sales must fall within the price band around it.
- **Escrow and a cooling-off period** (placeholder: 24 real hours) before ownership transfers, so either side can cancel.
- **What transfers:** the asset, its upgrades and staff, but **not** its history of crimes. A business used as a Pablo front carries **its traces** with it, and the buyer is warned of "undisclosed issues" if traces exist, so laundering histories can't be washed by selling.
- **Limits:** a cap on asset sales per player per month, and a minimum ownership period before an asset can be resold (placeholder: 14 days).
- **Higher fee** than item trades (placeholder: 10%), shown upfront.

---

## 7. Abuse detection and review

- **Automatic flags:** lopsided trades at the edge of price bands, one account repeatedly sending to another, new accounts trading heavily, sudden spikes in a player's trading volume, and repeated trivial jobs between the same players.
- **Story Studio review queue:** flagged activity goes to a queue where the owner can approve, reverse, freeze an account's trading, or ban.
- **Reversal:** trades can be reversed within a window after a confirmed theft or exploit.
- **Analytics:** total value traded, fees collected, price trends and flag rates feed economy tuning (Frameworks Map 21).

---

## 8. Connections

| System | Connection |
| --- | --- |
| **Campaign Mode** | Campaign help jobs; candidates hire players as staff and volunteers |
| **Clout City Pablo** | Underworld jobs from real players (NPC targets only), with Heat for both |
| **Ownership** | Business shifts as jobs; business and property sales |
| **Moral Choices** | Scamming or breaking deals lowers Integrity; underworld jobs raise Heat |
| **Relationships** | Gifts and jobs strengthen crew and friendships |
| **News and gossip** | Big deals and dramatic gifts can appear in Lola's gossip |
| **Economy** | Fees remove C$; limits keep trading in proportion to normal earnings |

---

## 9. Data model (Supabase sketch)

- `gifts` (id, giver\_id, recipient\_id, item\_id, message, status, created\_at, no\_resale\_until)
- `player_jobs` (id, employer\_id, worker\_id, job\_type, target\_ref, pay\_cs, fee\_cs, escrow\_status, deadline, verified\_at, status)
- `listings` (id, seller\_id, item\_id, price\_cs, visibility, status, created\_at)
- `trades` (id, player\_a\_id, player\_b\_id, items\_a, items\_b, cs\_a, cs\_b, fee\_cs, escrow\_status, confirmed\_at, reversed)
- `asset_sales` (id, seller\_id, buyer\_id, asset\_type, asset\_id, appraisal\_cs, price\_cs, fee\_cs, cooling\_off\_until, status)
- `trade_limits` (player\_id, week, sent\_value\_cs, received\_value\_cs)
- `trade_flags` (id, rule, player\_ids, ref\_id, status, reviewed\_by, outcome)
- `ratings` (id, rater\_id, ratee\_id, job\_id, score)

---

## 10. Phases

| Phase | Ships | Requires |
| --- | --- | --- |
| **1** | Gifting Shop items; player jobs with escrow (campaign help, event support, business shifts, errands, crew goals) | Core rules (2), weekly limits, history, basic abuse flags |
| **2** | Item marketplace with listings, swaps and the trade window; underworld jobs from players (NPC targets only) | Price bands, trade holds, server validation, the Studio review queue |
| **3** | Business and property sales | Appraisal, cooling-off, trace transfer, analytics in place |

Each phase ships only after the previous phase's abuse flags have run for a few weeks without serious problems.

---

## 11. Legal note

Transferable virtual items in a game that also sells things for real money can raise money-transmission, consumer-protection or gambling questions in some jurisdictions, especially near the lottery. Keep C$ and items without any cash-out, keep trading separate from the lottery, and have a lawyer review the player economy before phase 2 launches.

---

## 12. Open questions

- What account age and clout level should unlock each phase?
- What weekly limits are fair relative to normal earnings?
- Should the open marketplace show prices publicly (price history) to help players and spot manipulation?
- Should crew members get lower fees with each other?
- Can players hire each other for real-time help during exclusive events?
- How long should the reversal window be after a reported theft?
