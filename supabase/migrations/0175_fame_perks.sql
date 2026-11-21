-- 0175: Fame perks and rewards that grow with you (owner, Nov 21: "build 1 and 2", after the reward review; lib/fame.ts).
--   * game_settings 'fame' (from lib/fame.ts fameSettings; tests/fame.test.ts compares).
--   * fame_on_ledger (a ledger trigger that never raises) pays the perks and the rank bonus as new ledger rows, so no payment
--     code changes:
--       - Rewards that grow: a positive daily_task, daily_bonus, visit, event or place_life row earns +20% a rank above the
--         first (at most ×2.8), ledger 'fame_scale', once per row.
--       - Rank 2: the first event ticket of a New York week comes back (ledger 'fame_ticket', ref = that Monday).
--       - Rank 3: the first meal of the day ('eat') comes back (ledger 'fame_comp', ref = the day).
--       - Rank 4: one celebrity-hosted Scene move a day is free (its scene_cost comes back, 'fame_invite', ref = the day).
--       - Rank 7: a Gala gift's clout is matched ('fame_match').
--       - Rank 8: Scene moves pay 10% more ('fame_paparazzi').
--     The rank is players.best_rank (or what clout and the bank give now, whichever is higher).
--   * fame_on_rank (a players trigger): reaching each rank from 5 posts Lola's Spotlight in the News (a 'win' headline,
--     never for News opt-outs); Rank 10 adds the badge 'mayor-day'.
--   * fame_state() for the perks sheet: the rank, the multiplier, and whether this week's ticket, today's meal and today's
--     invite are used.
--   * Goals: ten more rungs for Ranks 6 to 10 (lib/goals.ts). Scene: the Rank 9 move "Throw your own night".
-- Safe to run more than once.

insert into public.game_settings (key, value) values ('fame', '{"perRank":0.2,"cap":2.8,"scaleKinds":["daily_task","daily_bonus","visit","event","place_life"],"paparazzi":0.1,"perks":{"ticket":2,"comp":3,"invite":4,"spotlight":5,"match":7,"paparazzi":8},"spotlight":{"5":"📸 Lola’s Spotlight: {name} is officially On the List. The bouncers nod now. Sources say they practised nodding back.","6":"📸 Lola’s Spotlight: {name} is a Local Celebrity. Recognised at the grocery store; pretended not to be. Badly.","7":"📸 Lola’s Spotlight: {name} has Nepo Baby Energy now. Every VIP rope opens. Nobody’s sure whose kid they are.","8":"📸 Lola’s Spotlight: {name} is New Money Rich. The paparazzi have their schedule. Everything they own is still in the box.","9":"📸 Lola’s Spotlight: {name} made Self-Made Billionaire*. Terms and conditions apply. They’re throwing their own night.","10":"🗽 Mayor Papa-Dani declares today {name} Day. God Status. The city speaks their name in hushed tones."},"hosted":["barksley-bday","brick-reading","brock-premiere","car-auction","chad-launch","chardonnay-reunion","chase-stream","crab-breakfast","dj-polaroid","duke-watches","dunk-box","lunaria-drop","mayor-ribbon","peyton-apology","ruckus-listening","ruckus-radio","saffron-bday","skyler-panel","tiff-collab","vale-front-row"]}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into public.game_settings (key, value) values ('goals', '{"ladder":[{"id":"regular","unlock":0,"reward":25,"lean":"cash","tags":["bodega"],"check":{"type":"regular","place":"ditmars-deli","days":3}},{"id":"first_purchase","unlock":0,"reward":25,"lean":"cash","tags":["boutique","shopping"],"check":{"type":"purchase"}},{"id":"first_shift","unlock":0,"reward":25,"lean":"cash","tags":[],"check":{"type":"shift"}},{"id":"full_day","unlock":0,"reward":50,"lean":"boost","tags":[],"check":{"type":"full_day"}},{"id":"first_gig","unlock":0,"reward":50,"lean":"boost","tags":["gym","campus","club","monument"],"check":{"type":"gig"}},{"id":"own_place","unlock":0,"reward":75,"lean":"cash","tags":[],"check":{"type":"solo"}},{"id":"campaign_start","unlock":0,"reward":75,"lean":"boost","tags":[],"check":{"type":"campaign_started"},"side":true},{"id":"first_crew","unlock":100,"reward":75,"lean":"boost","tags":["club","nightlife"],"check":{"type":"crew","count":1}},{"id":"save_15k","unlock":100,"reward":75,"lean":"cash","tags":[],"check":{"type":"save","cash":15000}},{"id":"skill_3","unlock":100,"reward":75,"lean":"boost","tags":["gym","campus"],"check":{"type":"skill","level":3}},{"id":"campaign_week3","unlock":100,"reward":75,"lean":"boost","tags":[],"check":{"type":"campaign_week","week":3},"side":true},{"id":"pro_gigs","unlock":500,"reward":150,"lean":"boost","tags":["gym","campus","club","monument"],"check":{"type":"gig_tier","tier":"pro"}},{"id":"first_business","unlock":500,"reward":150,"lean":"cash","tags":[],"check":{"type":"business","id":"hot-dog-cart"}},{"id":"move_up","unlock":500,"reward":150,"lean":"cash","tags":[],"check":{"type":"home","home":"jackson_heights_1br"}},{"id":"campaign_debate","unlock":500,"reward":150,"lean":"boost","tags":[],"check":{"type":"debate_won"},"side":true},{"id":"campaign_finish","unlock":500,"reward":150,"lean":"boost","tags":[],"check":{"type":"campaign_finished"},"side":true},{"id":"first_car","unlock":1000,"reward":200,"lean":"cash","tags":["dealership","cars"],"check":{"type":"car"}},{"id":"move_sunnyside","unlock":1000,"reward":200,"lean":"cash","tags":[],"check":{"type":"home","home":"sunnyside_gardens"}},{"id":"skill_5","unlock":1000,"reward":200,"lean":"boost","tags":["gym","campus"],"check":{"type":"skill","level":5}},{"id":"campaign_win","unlock":1000,"reward":200,"lean":"boost","tags":[],"check":{"type":"campaign_won"},"side":true},{"id":"big_gigs","unlock":2000,"reward":300,"lean":"boost","tags":["gym","campus","club","monument"],"check":{"type":"gig_tier","tier":"big"}},{"id":"ultraviolet","unlock":2000,"reward":300,"lean":"boost","tags":["club","nightlife"],"check":{"type":"door","place":"ultraviolet-society"}},{"id":"bodega","unlock":2000,"reward":300,"lean":"cash","tags":[],"check":{"type":"business","id":"bodega"}},{"id":"campaign_clean","unlock":2000,"reward":300,"lean":"boost","tags":[],"check":{"type":"campaign_won","clean":true},"side":true},{"id":"vip_floor","unlock":5000,"reward":500,"lean":"boost","tags":["club","nightlife"],"check":{"type":"vip","level":"medium"}},{"id":"move_highrise","unlock":5000,"reward":500,"lean":"cash","tags":[],"check":{"type":"home","home":"lic_highrise"}},{"id":"campaign_all","unlock":5000,"reward":500,"lean":"boost","tags":[],"check":{"type":"candidates_run","count":4},"side":true},{"id":"skill_7","unlock":5000,"reward":600,"lean":"boost","tags":[],"check":{"type":"skill","level":7}},{"id":"save_100k","unlock":5000,"reward":600,"lean":"cash","tags":[],"check":{"type":"save","cash":100000}},{"id":"own_home","unlock":15000,"reward":1500,"lean":"cash","tags":["furniture","home"],"check":{"type":"house","sku":"house-astoria-townhouse"}},{"id":"laundromat","unlock":15000,"reward":750,"lean":"cash","tags":[],"check":{"type":"business","id":"laundromat"}},{"id":"rooftop_regular","unlock":15000,"reward":1500,"lean":"boost","tags":["rooftop"],"check":{"type":"regular","place":"ditmars-heights-rooftop","days":10}},{"id":"skill_9","unlock":15000,"reward":1500,"lean":"boost","tags":[],"check":{"type":"skill","level":9}},{"id":"save_1m","unlock":15000,"reward":1500,"lean":"cash","tags":[],"check":{"type":"save","cash":1000000}},{"id":"penthouse","unlock":50000,"reward":2500,"lean":"cash","tags":["furniture","home"],"check":{"type":"house","sku":"house-lic-penthouse"}},{"id":"cafe","unlock":50000,"reward":2500,"lean":"cash","tags":[],"check":{"type":"business","id":"cafe"}},{"id":"skill_10","unlock":50000,"reward":2500,"lean":"boost","tags":[],"check":{"type":"skill","level":10}},{"id":"save_10m","unlock":50000,"reward":2500,"lean":"cash","tags":[],"check":{"type":"save","cash":10000000}},{"id":"duplex","unlock":150000,"reward":5000,"lean":"cash","tags":["furniture","home"],"check":{"type":"house","sku":"house-hunters-point-duplex"}},{"id":"taco_trucks","unlock":150000,"reward":5000,"lean":"cash","tags":[],"check":{"type":"business","id":"taco-trucks"}},{"id":"nightclub","unlock":150000,"reward":5000,"lean":"cash","tags":["club","nightlife"],"check":{"type":"business","id":"nightclub"}},{"id":"save_100m","unlock":150000,"reward":5000,"lean":"cash","tags":[],"check":{"type":"save","cash":100000000}},{"id":"go_public","unlock":500000,"reward":10000,"lean":"boost","tags":[],"check":{"type":"public"}},{"id":"save_1b","unlock":500000,"reward":10000,"lean":"cash","tags":[],"check":{"type":"save","cash":1000000000}}],"goalTasksPerDay":2,"streak":{"freezesPerWeek":1,"day3Clout":50,"every":7,"collectibles":["home-neon-five-sign","home-trophy-shelf","home-employee-frame","home-streak-lava-lamp"],"fallbackClout":100}}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into public.game_settings (key, value) values ('scene', '{"slots":[[1,2],[3,3],[5,4],[7,5]],"hypes":{"2":0,"8":2,"24":2,"72":3},"hypeGapMin":60,"staleAfter":{"2":4,"8":8,"24":12,"72":24},"stalePay":0.25,"missedHype":0.25,"pointsPer":0.2,"costPerRank":0.1,"crewHypeClout":5,"plaques":[{"at":10,"clout":50},{"at":25,"clout":150},{"at":50,"clout":400}],"residency":{"needs":10,"days":7,"pay":0.5},"sneak":{"confidence":{"integrity":0,"banHours":0,"extra":0},"namedrop":{"integrity":-3,"banHours":24,"extra":0},"bribe":{"integrity":-2,"banHours":0,"extra":0.5}},"moves":{"brunch-be-seen":{"places":["grind-and-gossip","ditmars-deli","feta-compli","schlep-and-schmear"],"hours":2,"cost":40,"energy":10,"clout":45,"score":"style","skill":"charisma","gated":false},"open-mic":{"places":["velvet-static","low-light-lounge","brownstone-sessions"],"hours":2,"cost":0,"energy":15,"clout":50,"score":"stage","skill":"music","gated":false},"night-out":{"places":["velvet-static","hellgate-hall","the-sticky-floor","discount-disco"],"hours":8,"cost":120,"energy":20,"clout":130,"score":"nightlife","skill":"dance","gated":false},"photo-walk":{"places":["gantry-plaza","unisphere","hell-gate-park"],"hours":2,"cost":0,"energy":10,"clout":40,"score":"street","skill":"photography","gated":false},"run-club":{"places":["hell-gate-park","flushing-meadows"],"hours":2,"cost":0,"energy":20,"clout":35,"score":"social","skill":"fitness","gated":false},"window-shop":{"places":["atelier-vernon","thread-count"],"hours":2,"cost":0,"energy":5,"clout":35,"score":"style","skill":"photography","gated":false},"jazz-table":{"places":["low-light-lounge","brownstone-sessions"],"hours":8,"cost":90,"energy":10,"clout":110,"score":"nightlife","skill":"music","gated":false},"meteors-game":{"places":["meteor-park"],"hours":8,"cost":60,"energy":15,"clout":100,"score":"street","skill":"charisma","gated":false},"diner-court":{"places":["neon-spoon","still-a-dollar-slice"],"hours":2,"cost":25,"energy":5,"clout":35,"score":"social","skill":"gossip","gated":false},"chad-launch":{"places":["triborough-works","grind-and-gossip"],"hours":2,"cost":0,"energy":10,"clout":40,"score":"status","skill":"hustle","gated":false},"tiff-collab":{"places":["gantry-plaza","grind-and-gossip"],"hours":2,"cost":0,"energy":5,"clout":35,"score":"social","skill":"photography","gated":false},"dj-polaroid":{"places":["velvet-static","hellgate-hall"],"hours":2,"cost":15,"energy":10,"clout":40,"score":"nightlife","skill":"dance","gated":false},"barksley-bday":{"places":["hell-gate-park"],"hours":2,"cost":30,"energy":5,"clout":50,"score":"social","skill":"charisma","gated":false},"panel-speak":{"places":["triborough-works","queensboro-capital","skybridge-tower"],"hours":8,"cost":0,"energy":15,"clout":160,"score":"status","skill":"smarts","needs":{"rank":4},"gated":false,"headline":"{name} said “synergy” on a panel and nobody laughed. Growth."},"guest-lecture":{"places":["st-johnsons","queensborough-u","astoria-cc"],"hours":8,"cost":0,"energy":15,"clout":150,"score":"stage","skill":"smarts","needs":{"rank":5},"gated":false,"headline":"{name} gave a guest lecture. Thirty rows of students pretended to take notes."},"fundraiser":{"places":["ditmars-heights-rooftop"],"hours":24,"cost":800,"energy":15,"clout":280,"score":"status","skill":"charisma","needs":{"rank":4,"netWorth":50000},"gated":false,"headline":"{name} wrote a very large cheque at the fundraiser, where everyone could see it. Generous. Visible."},"talk-show":{"places":["clout-tower"],"hours":24,"cost":0,"energy":20,"clout":350,"score":"stage","skill":"charisma","needs":{"rank":5},"gated":false,"headline":"{name} went on the talk show and said something unforgettable. Nobody can agree what."},"rooftop-dinner":{"places":["ditmars-heights-rooftop","altitude-718","up-on-thirty"],"hours":8,"cost":200,"energy":10,"clout":140,"score":"nightlife","skill":"charisma","needs":{"rank":2},"gated":false},"crab-breakfast":{"places":["ditmars-heights-rooftop"],"hours":8,"cost":300,"energy":10,"clout":200,"score":"status","skill":"charisma","needs":{"rank":3},"gated":false,"headline":"{name} survived Prince Nassim’s golden crab breakfast. The crabs did not."},"car-auction":{"places":["boulevard-motors"],"hours":24,"cost":1500,"energy":10,"clout":320,"score":"status","skill":"hustle","needs":{"netWorth":100000},"gated":false,"headline":"{name} outbid Prince Nassim at the car auction. Sources say he bought the auction house out of spite."},"saffron-bday":{"places":["velvet-static","ultraviolet-society"],"hours":8,"cost":200,"energy":25,"clout":190,"score":"nightlife","skill":"dance","needs":{"rank":4},"gated":false,"headline":"{name} crashed Saffron Lux’s birthday. She called them “angel” nine times and their name zero."},"vale-front-row":{"places":["atelier-vernon"],"hours":8,"cost":250,"energy":10,"clout":210,"score":"style","skill":"photography","needs":{"rank":4},"gated":false,"headline":"{name} sat front row at Vale Sartorio. Vale did not clap. {name} did not clap. A connection."},"ruckus-listening":{"places":["velvet-static","hellgate-hall","real-clout-fm"],"hours":8,"cost":80,"energy":15,"clout":150,"score":"nightlife","skill":"music","needs":{"rank":2},"gated":false},"ruckus-radio":{"places":["real-clout-fm"],"hours":2,"cost":0,"energy":10,"clout":70,"score":"stage","skill":"gossip","needs":{"rank":3},"gated":false},"lunaria-drop":{"places":["real-clout-fm"],"hours":8,"cost":0,"energy":20,"clout":170,"score":"stage","skill":"music","needs":{"rank":5},"gated":false,"headline":"{name} was first to Lunaria’s 3 AM drop. Insiders call it “vaguely iconic”."},"brock-premiere":{"places":["clout-tower","reel-queens"],"hours":8,"cost":150,"energy":10,"clout":180,"score":"style","skill":"photography","needs":{"rank":4},"gated":false,"headline":"{name} walked the red carpet at Brock Squarejaw’s premiere. Brock insists he is 35."},"dunk-box":{"places":["meteor-park"],"hours":8,"cost":400,"energy":10,"clout":200,"score":"status","skill":"charisma","needs":{"rank":5},"gated":false,"headline":"{name} sat with Dunk Daniels at the Meteors. Dunk arrived in the seventh inning, in new sneakers."},"skyler-panel":{"places":["triborough-works","skybridge-tower"],"hours":2,"cost":0,"energy":10,"clout":70,"score":"status","skill":"smarts","needs":{"rank":2},"gated":false},"chardonnay-reunion":{"places":["clout-tower"],"hours":8,"cost":0,"energy":15,"clout":170,"score":"stage","skill":"gossip","needs":{"rank":4},"gated":false,"headline":"{name} survived Chardonnay Shade’s reunion taping. Barely. Sit near the exit next time."},"peyton-apology":{"places":["grind-and-gossip","feta-compli"],"hours":2,"cost":50,"energy":10,"clout":60,"score":"social","skill":"photography","needs":{"rank":2},"gated":false},"chase-stream":{"places":["glow-up-house"],"hours":8,"cost":0,"energy":25,"clout":150,"score":"stage","skill":"charisma","needs":{"rank":3},"gated":false},"duke-watches":{"places":["queensboro-capital"],"hours":24,"cost":0,"energy":5,"clout":300,"score":"status","skill":"photography","needs":{"netWorth":250000},"gated":false,"headline":"{name} viewed Duke Ledger’s watches in private. Nobody asked the price, or his age."},"mayor-ribbon":{"places":["city-hall-annex"],"hours":2,"cost":0,"energy":10,"clout":80,"score":"street","skill":"charisma","needs":{"rank":3},"gated":false},"brick-reading":{"places":["clout-tower","ditmars-library"],"hours":2,"cost":0,"energy":5,"clout":60,"score":"stage","skill":"smarts","needs":{"rank":2},"gated":false},"brunch-date":{"places":["grind-and-gossip","feta-compli","ditmars-deli"],"hours":2,"cost":60,"energy":10,"clout":80,"score":"social","skill":"charisma","gated":true},"speed-dating":{"places":["low-light-lounge","velvet-static"],"hours":2,"cost":30,"energy":10,"clout":50,"score":"social","skill":"charisma","gated":true},"revenge-glowup":{"places":["velvet-static","ditmars-heights-rooftop"],"hours":8,"cost":120,"energy":20,"clout":160,"score":"nightlife","skill":"dance","gated":true},"study-gram":{"places":["st-johnsons","queensborough-u","astoria-cc","ditmars-library"],"hours":2,"cost":0,"energy":10,"clout":45,"score":"social","skill":"smarts","gated":true},"greek-row":{"places":["st-johnsons","queensborough-u","astoria-cc"],"hours":8,"cost":20,"energy":25,"clout":120,"score":"nightlife","skill":"dance","gated":true},"work-the-quad":{"places":["st-johnsons","queensborough-u","astoria-cc"],"hours":2,"cost":0,"energy":15,"clout":60,"score":"social","skill":"charisma","gated":true},"investor-brunch":{"places":["feta-compli","grind-and-gossip","queensboro-capital"],"hours":8,"cost":150,"energy":10,"clout":170,"score":"status","skill":"hustle","gated":true},"launch-party":{"places":["ditmars-heights-rooftop","velvet-static"],"hours":24,"cost":1200,"energy":20,"clout":320,"score":"status","skill":"hustle","gated":true,"headline":"{name} threw a launch party with a sign that spelled their name right. A first for Queens."},"trading-pitch":{"places":["queensboro-capital"],"hours":24,"cost":0,"energy":20,"clout":260,"score":"status","skill":"hustle","needs":{"rank":3},"gated":true},"opening-bell":{"places":["queensboro-capital"],"hours":24,"cost":0,"energy":10,"clout":400,"score":"status","skill":"hustle","gated":true,"headline":"{name} rang the opening bell. The market did something. Their business posed for twenty minutes."},"demo-day":{"places":["triborough-works"],"hours":8,"cost":0,"energy":15,"clout":140,"score":"status","skill":"smarts","gated":true},"tv-cameo":{"places":["clout-tower"],"hours":2,"cost":0,"energy":10,"clout":70,"score":"stage","skill":"charisma","gated":true},"latte-art":{"places":["grind-and-gossip"],"hours":2,"cost":0,"energy":10,"clout":55,"score":"stage","skill":"cooking","gated":true},"front-row-intern":{"places":["atelier-vernon"],"hours":8,"cost":0,"energy":15,"clout":140,"score":"style","skill":"photography","gated":true},"promotion-drinks":{"places":["low-light-lounge","ditmars-heights-rooftop"],"hours":8,"cost":100,"energy":10,"clout":140,"score":"social","skill":"charisma","gated":true},"kiss-babies":{"places":["hell-gate-park","flushing-meadows"],"hours":2,"cost":0,"energy":15,"clout":70,"score":"street","skill":"charisma","gated":true},"spin-room":{"places":["campaign-hq","city-hall-annex"],"hours":8,"cost":0,"energy":15,"clout":150,"score":"stage","skill":"gossip","gated":true},"free-gallery":{"places":["atelier-vernon","gantry-plaza"],"hours":2,"cost":0,"energy":5,"clout":45,"score":"style","skill":"photography","gated":true},"sample-sale":{"places":["atelier-vernon"],"hours":2,"cost":0,"energy":15,"clout":60,"score":"style","skill":"hustle","gated":true},"pool-party":{"places":["ditmars-heights-rooftop","altitude-718"],"hours":8,"cost":60,"energy":15,"clout":150,"score":"nightlife","skill":"fitness","gated":true},"candle-mic":{"places":["low-light-lounge","brownstone-sessions"],"hours":2,"cost":0,"energy":10,"clout":70,"score":"stage","skill":"music","gated":true},"festival-front":{"places":["flushing-meadows","hell-gate-park"],"hours":8,"cost":40,"energy":20,"clout":140,"score":"street","skill":"dance","gated":true},"charity-5k":{"places":["hell-gate-park","flushing-meadows"],"hours":2,"cost":20,"energy":25,"clout":70,"score":"social","skill":"fitness","gated":true},"publicity-stunt":{"places":["gantry-plaza","unisphere"],"hours":2,"cost":0,"energy":15,"clout":70,"score":"street","skill":"hustle","gated":true},"own-night":{"places":["velvet-static","hellgate-hall","ultraviolet-society"],"hours":24,"cost":2000,"energy":25,"clout":600,"score":"nightlife","skill":"dance","needs":{"rank":9},"gated":false,"headline":"{name} threw their own night and the line went round the block. Prince Nassim tried to buy the club. Again."}}}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

/** A player's rank for perks: the best reached, or what clout and the bank give now. */
create or replace function public.fame_rank(p_player uuid) returns int
language sql stable security definer set search_path = public
as $$
  select greatest(coalesce(p.best_rank, 1), public.rank_level(p.clout, p.bank_cash))::int from public.players p where p.id = p_player
$$;

/** Pays one fame row once and moves the balance. */
create or replace function public.fame_pay(p_player uuid, p_currency text, p_amount bigint, p_kind text, p_ref text) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_amount = 0 then return; end if;
  if public.ledger_once(p_player, p_currency, p_amount, p_kind, p_ref) then
    if p_currency = 'cash' then update public.players set bank_cash = bank_cash + p_amount where id = p_player;
    else update public.players set clout = clout + p_amount where id = p_player; end if;
  end if;
end;
$$;

create or replace function public.fame_on_ledger() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  s jsonb;
  rk int;
  mult numeric;
  today date;
  monday date;
  mv text;
  hosted boolean;
begin
  if new.kind like 'fame_%' or new.amount = 0 then return new; end if;
  begin
    s := public.game_settings_value('fame');
    if s is null then return new; end if;
    rk := public.fame_rank(new.player_id);
    if rk is null or rk < 2 then return new; end if;
    today := public.ny_today();
    monday := today - (extract(isodow from today)::int - 1);
    -- Rewards that grow with you.
    if new.amount > 0 and (s -> 'scaleKinds') ? new.kind then
      mult := least((s ->> 'cap')::numeric, 1 + (s ->> 'perRank')::numeric * (rk - 1));
      perform public.fame_pay(new.player_id, new.currency, round(new.amount * (mult - 1))::bigint, 'fame_scale', new.kind || ':' || new.ref);
    end if;
    -- Rank 2: the week's first event ticket.
    if new.kind = 'event_entry' and new.currency = 'cash' and new.amount < 0 and rk >= (s #>> '{perks,ticket}')::int then
      perform public.fame_pay(new.player_id, 'cash', -new.amount, 'fame_ticket', monday::text);
    end if;
    -- Rank 3: the day's first meal.
    if new.kind = 'eat' and new.currency = 'cash' and new.amount < 0 and rk >= (s #>> '{perks,comp}')::int then
      perform public.fame_pay(new.player_id, 'cash', -new.amount, 'fame_comp', today::text);
    end if;
    -- Rank 4: a celebrity-hosted Scene move a day is free.
    if new.kind = 'scene_cost' and new.currency = 'cash' and new.amount < 0 and rk >= (s #>> '{perks,invite}')::int
       and new.ref ~ '^[0-9a-f-]{36}$' then
      select m.move into mv from public.scene_moves m where m.id = new.ref::uuid;
      hosted := mv is not null and ((s -> 'hosted') ? mv
        or exists (select 1 from public.scene_week_moves w where w.id = mv and w.move ? 'host'));
      if hosted then perform public.fame_pay(new.player_id, 'cash', -new.amount, 'fame_invite', today::text); end if;
    end if;
    -- Rank 7: a Gala gift's clout is matched.
    if new.kind = 'gala' and new.currency = 'clout' and new.amount > 0 and rk >= (s #>> '{perks,match}')::int then
      perform public.fame_pay(new.player_id, 'clout', new.amount, 'fame_match', new.ref);
    end if;
    -- Rank 8: the paparazzi follow you.
    if new.kind = 'scene' and new.currency = 'clout' and new.amount > 0 and rk >= (s #>> '{perks,paparazzi}')::int then
      perform public.fame_pay(new.player_id, 'clout', round(new.amount * (s ->> 'paparazzi')::numeric)::bigint, 'fame_paparazzi', new.ref);
    end if;
  exception when others then
    raise warning 'fame_on_ledger: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists ledger_fame on public.ledger;
create trigger ledger_fame after insert on public.ledger
  for each row execute function public.fame_on_ledger();

/** Lola's Spotlight at each new best rank from 5; the Mayor's day at 10. */
create or replace function public.fame_on_rank() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  s jsonb;
  r int;
  line text;
begin
  if new.best_rank is not distinct from old.best_rank or coalesce(new.best_rank, 0) <= coalesce(old.best_rank, 0) then return new; end if;
  begin
    s := public.game_settings_value('fame');
    for r in (coalesce(old.best_rank, 1) + 1)..new.best_rank loop
      line := s -> 'spotlight' ->> r::text;
      if line is not null and not coalesce(new.news_opt_out, false) then
        insert into public.choice_headlines (player_id, text, kind)
        values (new.id, left(replace(line, '{name}', '@' || new.display_name), 260), 'win');
      end if;
      if r = 10 then
        insert into public.player_badges (player_id, badge_id, arc_id) values (new.id, 'mayor-day', 'fame') on conflict do nothing;
      end if;
    end loop;
  exception when others then
    raise warning 'fame_on_rank: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists players_fame_rank on public.players;
create trigger players_fame_rank after update of best_rank on public.players
  for each row execute function public.fame_on_rank();

/** The perks sheet: rank, multiplier, and this week's ticket, today's meal and today's invite. */
create or replace function public.fame_state() returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'rank', public.fame_rank(auth.uid()),
    'ticketUsed', exists (select 1 from public.ledger where player_id = auth.uid() and kind = 'fame_ticket'
                           and ref = (public.ny_today() - (extract(isodow from public.ny_today())::int - 1))::text),
    'compUsed', exists (select 1 from public.ledger where player_id = auth.uid() and kind = 'fame_comp' and ref = public.ny_today()::text),
    'inviteUsed', exists (select 1 from public.ledger where player_id = auth.uid() and kind = 'fame_invite' and ref = public.ny_today()::text))
  where auth.uid() is not null
$$;

revoke all on function public.fame_rank(uuid) from public, anon, authenticated;
revoke all on function public.fame_pay(uuid, text, bigint, text, text) from public, anon, authenticated;
revoke all on function public.fame_on_ledger() from public, anon, authenticated;
revoke all on function public.fame_on_rank() from public, anon, authenticated;
revoke all on function public.fame_state() from public, anon;
grant execute on function public.fame_state() to authenticated;
