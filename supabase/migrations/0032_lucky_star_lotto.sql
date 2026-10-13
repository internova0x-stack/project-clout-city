-- v0.10 step 1 (docs/08-new-features-spec.md section 7; owner Oct 13): Lucky Star Lotto in Flushing.
--
-- Five scratch-card games (C$5 to C$100; each top prize is 1,000 times the card) share one fixed prize
-- table in game_settings (city.economy.lotto, mirrored in lib/city.ts). One free card a day (the C$5
-- game), a second through a player's first 7 days, and 5 bought cards a day; all reset at midnight in
-- New York. 10% of every bought card feeds this week's jackpot (drawn in step 2).
--
-- The browser can't rig anything. It only names a game; the price, the limits and the prize all come
-- from here. The prize is drawn when the card is bought, from Postgres's cryptographic random source
-- (gen_random_uuid), and stored where players can't read it: lotto_cards has no policies, and
-- lotto_state() lists unscratched cards without their prizes. Scratching asks the server, which
-- reveals and pays the stored prize once (ledger, ref game:card, unique per card). Real money never touches the lotto.

-- The city seed gains the lotto numbers and the Lucky Star place (scripts/gen-city-seed.ts).
update public.game_settings set value = '{"economy":{"shiftRate":120,"cloutPerDollar":0.6,"baseVisitClout":5,"cloutMultiplier":{"base":0.7,"mood":0.3,"confidence":0.3},"energy":{"dailyTopUp":20,"eventCost":20},"confidenceDriftPerDay":3,"dailyTasks":{"count":5,"rewardMin":40,"rewardMax":90,"bonus":150},"sellRate":0.6,"purchaseCloutDecay":0.85,"bills":{"every":"7 days","carRentalDays":7,"phone":25,"graceDays":2,"moodDropPerDay":8,"evictAfterDays":6,"carInsuranceRate":0.005},"gigs":{"side":{"confidence":0,"clout":0,"chance":0.9,"payMin":3,"payMax":5,"energy":1.5,"waitMinutes":60},"pro":{"confidence":50,"clout":500,"chance":0.5,"payMin":8,"payMax":10,"energy":2,"waitMinutes":120},"big":{"confidence":80,"clout":2000,"chance":0.22,"payMin":15,"payMax":20,"energy":3,"waitMinutes":240}},"shiftEnergy":25,"rest":{"nap":{"energy":30,"mood":0,"perDay":2,"seconds":8},"sit":{"energy":10,"mood":6,"perDay":3,"seconds":0}},"barDrink":{"price":28,"energy":20,"tags":["club","lounge"]},"groceries":{"fridgeMax":10,"cook":{"energy":25,"seconds":6},"tags":["supermarket"],"bundles":[{"id":"snack-run","emoji":"🥪","label":"Snack run","price":12,"meals":2,"blurb":"Chips, hummus, one sad apple. Technically two meals."},{"id":"meal-prep","emoji":"🥦","label":"Meal prep for the week","price":35,"meals":7,"blurb":"Seven containers, one Sunday, infinite smugness."}]},"travel":{"bandsMiles":[0.5,2,5],"walk":{"energy":[5,10,20,null],"seconds":[6,8,10,null]},"subway":{"fare":3,"seconds":[5,6,7,8]},"taxi":{"fare":[8,16,28,45],"seconds":[3,4,5,6]},"car":{"seconds":[3,4,5,6]}},"hunt":{"cash":1080,"clout":250,"retryMinutes":10,"badgeAfter":4},"lotto":{"tags":["lotto"],"freeGame":"corner-store","freePerDay":1,"beginner":{"days":7,"extraPerDay":1},"buyPerDay":5,"jackpot":{"seed":5000,"cut":0.1},"prizes":[{"times":1,"per100k":20000},{"times":2,"per100k":10000},{"times":5,"per100k":2500},{"times":20,"per100k":250},{"times":100,"per100k":20},{"times":1000,"per100k":1}],"bigFrom":100,"games":[{"id":"corner-store","name":"Corner Store Classic","price":5,"color":"#40B589","blurb":"The one your uncle buys with exact change."},{"id":"bodega-cat","name":"Bodega Cat Bonanza","price":10,"color":"#3E8EDE","blurb":"The cat picked the numbers. The cat has never been wrong."},{"id":"rents-due","name":"Rent''s Due","price":20,"color":"#FF2E88","blurb":"Financial planning, but make it shiny."},{"id":"penthouse-dreams","name":"Penthouse Dreams","price":50,"color":"#7A4FD6","blurb":"Scratch here to see the view. The view is the counter."},{"id":"main-character","name":"Main Character","price":100,"color":"#2A2530","blurb":"For people who are sure the plot is about them."}]}},"places":[{"id":"velvet-static","tags":["club","nightlife","first_party_venue"],"story":null,"at":[40.7465,-73.9455],"actions":[{"id":"visit","kind":"visit","price":60,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"grind-and-gossip","tags":["cafe","dining_medium","job_barista"],"story":null,"at":[40.7645,-73.9225],"actions":[{"id":"eat","kind":"eat","price":18,"pay":0,"energy":-30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"shift","kind":"shift","price":0,"pay":120,"energy":25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"lucky-seven-deli","tags":["bodega","dining_budget"],"story":null,"at":[40.7495,-73.8885],"actions":[{"id":"eat","kind":"eat","price":7,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"altitude-718","tags":["rooftop","dining_luxury"],"story":null,"at":[40.7425,-73.9555],"actions":[{"id":"eat","kind":"eat","price":95,"pay":0,"energy":-55,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"flushing-meadows","tags":["park","outdoors"],"story":null,"at":[40.742,-73.844],"actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pedal-pushers","tags":["delivery_hub","job_delivery"],"story":null,"at":[40.759,-73.928],"actions":[{"id":"shift","kind":"shift","price":0,"pay":135,"energy":30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skybridge-tower","tags":["office","gigs_board"],"story":null,"at":[40.7495,-73.9395],"actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skyline-pier","tags":["skyline_pier","residential","waterfront"],"story":"sarah-bird","at":[40.7478,-73.9592],"actions":[{"id":"lobby","kind":"visit","price":0,"pay":0,"energy":5,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"memorial","kind":"visit","price":0,"pay":0,"energy":2,"mood":4,"confidence":0,"clout":10,"storyUnlock":true}]},{"id":"hunters-pier","tags":["hunters_pier","waterfront","park"],"story":"sarah-bird","at":[40.7432,-73.9612],"actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rockaway-diner","tags":["rockaway_diner","diner","dining_budget"],"story":"sarah-bird","at":[40.7712,-73.9158],"actions":[{"id":"eat","kind":"eat","price":14,"pay":0,"energy":-25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"radiant-harbor","tags":["radiant_harbor","church"],"story":"sarah-bird","at":[40.7738,-73.9296],"actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pressed-iron-gym","tags":["pressed_iron","gym"],"story":"sarah-bird","at":[40.7662,-73.9118],"actions":[{"id":"workout","kind":"visit","price":15,"pay":0,"energy":20,"mood":3,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"unisphere","tags":["monument","park"],"story":null,"at":[40.7466,-73.8448],"actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":20,"storyUnlock":false},{"id":"tour","kind":"hangout","price":15,"pay":0,"energy":8,"mood":0,"confidence":5,"clout":null,"storyUnlock":false},{"id":"wish","kind":"hangout","price":1,"pay":0,"energy":0,"mood":4,"confidence":0,"clout":null,"storyUnlock":false},{"id":"pretzel","kind":"eat","price":5,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"people","kind":"hangout","price":0,"pay":0,"energy":3,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"gantry-plaza","tags":["monument","waterfront"],"story":null,"at":[40.7454,-73.9584],"actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":20,"storyUnlock":false},{"id":"photoshoot","kind":"hangout","price":0,"pay":0,"energy":10,"mood":0,"confidence":6,"clout":null,"storyUnlock":false},{"id":"picnic","kind":"eat","price":12,"pay":0,"energy":-20,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"ferries","kind":"hangout","price":0,"pay":0,"energy":2,"mood":7,"confidence":0,"clout":null,"storyUnlock":false},{"id":"run","kind":"hangout","price":0,"pay":0,"energy":15,"mood":4,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"low-light-lounge","tags":["lounge","nightlife","exclusive_venue"],"story":null,"at":[40.7612,-73.9175],"actions":[{"id":"visit","kind":"visit","price":45,"pay":0,"energy":10,"mood":8,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"thread-count","tags":["boutique","shopping","fashion"],"story":null,"at":[40.7651,-73.9204],"actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"boulevard-motors","tags":["dealership","shopping","cars"],"story":null,"at":[40.7503,-73.9372],"actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"st-johnsons","tags":["university","campus"],"story":null,"at":[40.7224,-73.7949],"actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false}]},{"id":"queensborough-u","tags":["university","campus"],"story":null,"at":[40.7366,-73.817],"actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false}]},{"id":"ditmars-deli","tags":["bodega","dining_budget","astoria"],"story":null,"at":[40.7748,-73.9128],"actions":[{"id":"eat","kind":"eat","price":6,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"two-bros-pizza","tags":["pizza","dining_budget","astoria"],"story":null,"at":[40.7668,-73.9208],"actions":[{"id":"eat","kind":"eat","price":4,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"neon-spoon","tags":["diner","dining_medium","astoria"],"story":null,"at":[40.7695,-73.9265],"actions":[{"id":"eat","kind":"eat","price":16,"pay":0,"energy":-28,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"up-on-thirty","tags":["rooftop","dining_luxury","astoria"],"story":null,"at":[40.7672,-73.9238],"actions":[{"id":"eat","kind":"eat","price":70,"pay":0,"energy":-50,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"steinway-fresh","tags":["supermarket","astoria"],"story":null,"at":[40.7628,-73.916],"actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"hellgate-hall","tags":["club","nightlife","astoria"],"story":null,"at":[40.7737,-73.9178],"actions":[{"id":"visit","kind":"visit","price":50,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"triborough-works","tags":["office","coworking","gigs_board","astoria"],"story":null,"at":[40.766,-73.9252],"actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"ditmars-library","tags":["library","free","astoria"],"story":null,"at":[40.7735,-73.9098],"actions":[{"id":"study","kind":"visit","price":0,"pay":0,"energy":10,"mood":0,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"precinct-114-half","tags":["police","free","astoria"],"story":null,"at":[40.769,-73.9228],"actions":[{"id":"report","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"engine-7","tags":["firehouse","free","astoria"],"story":null,"at":[40.772,-73.9205],"actions":[{"id":"pet-dog","kind":"visit","price":0,"pay":0,"energy":2,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"astoria-cc","tags":["college","campus","astoria"],"story":null,"at":[40.76,-73.9232],"actions":[{"id":"night-class","kind":"visit","price":20,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":10,"storyUnlock":false}]},{"id":"harmony-chapel","tags":["chapel","quiet","free","astoria"],"story":null,"at":[40.7652,-73.913],"actions":[{"id":"quiet","kind":"visit","price":0,"pay":0,"energy":2,"mood":7,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"hell-gate-park","tags":["park","outdoors","free","astoria"],"story":null,"at":[40.779,-73.9232],"actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rep-count","tags":["gym","astoria"],"story":null,"at":[40.764,-73.9146],"actions":[{"id":"workout","kind":"visit","price":12,"pay":0,"energy":20,"mood":2,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"astoria-blvd-station","tags":["subway","transit","free","astoria"],"story":null,"at":[40.7702,-73.918],"actions":[{"id":"platform","kind":"visit","price":0,"pay":0,"energy":2,"mood":2,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"reel-queens","tags":["cinema","date_spot","astoria"],"story":null,"at":[40.7605,-73.9196],"actions":[{"id":"movie","kind":"eat","price":15,"pay":0,"energy":-10,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"respawn-arena","tags":["games","arena","astoria"],"story":null,"at":[40.7708,-73.9105],"actions":[{"id":"match","kind":"visit","price":10,"pay":0,"energy":15,"mood":0,"confidence":5,"clout":12,"storyUnlock":false}]},{"id":"lucky-star","tags":["lotto","flushing"],"story":null,"at":[40.7593,-73.8301],"actions":[{"id":"chat","kind":"visit","price":0,"pay":0,"energy":2,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]}],"events":[{"id":"neon-nights","placeId":"velvet-static","startHour":22,"hours":5,"entry":80,"clout":60,"confidence":8,"mood":6},{"id":"bass-bath","placeId":"hellgate-hall","startHour":21,"hours":5,"entry":70,"clout":50,"confidence":7,"mood":7},{"id":"golden-hour","placeId":"velvet-static","startHour":15,"hours":4,"entry":50,"clout":40,"confidence":6,"mood":8},{"id":"homecoming-tailgate","placeId":"st-johnsons","startHour":16,"hours":4,"entry":15,"clout":35,"confidence":4,"mood":10},{"id":"quad-open-mic","placeId":"queensborough-u","startHour":19,"hours":3,"entry":10,"clout":30,"confidence":8,"mood":6}],"gigs":{"side":["Be a professional crowd at a gallery opening","Stand in line for a sneaker drop","Laugh on cue at a comedy open mic","Hold a ring light at a rooftop shoot"],"pro":["Run a launch campaign for a $14 artisanal ice cube startup","Ghost-write a podcast host''s \"authentic\" origin story","Manage socials for a dog with 40k followers"],"big":["Write a speech for a councilmember candidate","Art-direct a perfume ad for a fictional heiress"]},"shop":[{"sku":"fit-satin-bomber","category":"fashion","price":180,"clout":25,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false},{"sku":"fit-leather-blazer","category":"fashion","price":420,"clout":45,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false},{"sku":"fit-varsity-tee","category":"fashion","price":65,"clout":10,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false},{"sku":"fit-wide-trousers","category":"fashion","price":140,"clout":18,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false},{"sku":"fit-mini-skirt","category":"fashion","price":120,"clout":16,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false},{"sku":"fit-chunky-sneakers","category":"fashion","price":210,"clout":28,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":false},{"sku":"forever-our-bird-hoodie","category":"fashion","price":85,"clout":12,"rentPerWeek":0,"slot":"top","storyOnly":true,"collector":false},{"sku":"col-faux-chinchilla","category":"fashion","price":0,"clout":80,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":true},{"sku":"col-holo-boots","category":"fashion","price":0,"clout":70,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":true},{"sku":"fit-bucket-hat","category":"fashion","price":55,"clout":8,"rentPerWeek":0,"slot":"accessory","storyOnly":false,"collector":false},{"sku":"car-hatchback","category":"cars","price":14000,"clout":120,"rentPerWeek":350,"slot":null,"storyOnly":false,"collector":false},{"sku":"car-luxury-sedan","category":"cars","price":52000,"clout":300,"rentPerWeek":900,"slot":null,"storyOnly":false,"collector":false},{"sku":"car-electric-coupe","category":"cars","price":78000,"clout":420,"rentPerWeek":1300,"slot":null,"storyOnly":false,"collector":false},{"sku":"house-astoria-townhouse","category":"houses","price":180000,"clout":900,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"house-lic-penthouse","category":"houses","price":650000,"clout":2400,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"lux-gold-chain","category":"luxury","price":900,"clout":70,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"lux-diamond-studs","category":"luxury","price":2400,"clout":140,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"lux-designer-watch","category":"luxury","price":6800,"clout":260,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"mu-glow-kit","category":"makeup","price":75,"clout":12,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"mu-lip-set","category":"makeup","price":95,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"mu-lash-bar","category":"makeup","price":160,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false}],"homeLocations":{"astoria_studio":[40.7745,-73.905],"jackson_heights_1br":[40.752,-73.883],"lic_highrise":[40.747,-73.956]}}'::jsonb, updated_at = now() where key = 'city';

create table public.lotto_cards (
  id           bigint generated always as identity primary key,
  player_id    uuid not null references public.players (id) on delete cascade,
  game         text not null,
  -- The game's price (the card's face value) and what the player paid: 0 for a free card.
  price        int not null check (price > 0),
  paid         int not null check (paid >= 0),
  -- Drawn when the card is bought; only scratch_lotto_card hands it over.
  prize        int not null check (prize >= 0),
  -- This card's share of the week's jackpot (bought cards only).
  jackpot_cut  numeric(10, 2) not null default 0,
  ny_date      date not null,
  -- The New York week (its Monday): every card is one jackpot entry for that week.
  week         date not null check (extract(isodow from week) = 1),
  bought_at    timestamptz not null default now(),
  scratched_at timestamptz
);
create index lotto_cards_player_day_idx on public.lotto_cards (player_id, ny_date);
create index lotto_cards_week_idx on public.lotto_cards (week);
alter table public.lotto_cards enable row level security;
revoke all on public.lotto_cards from anon, authenticated;

/** A uniform whole number from 0 to 99,999, from the cryptographic random source, without modulo bias. */
create function public.lotto_roll() returns int
language plpgsql volatile security definer set search_path = public
as $$
declare v bigint;
begin
  loop
    -- The first 32 bits of a version 4 UUID are random (pg_strong_random).
    v := ('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint;
    if v < 4294900000 then return (v % 100000)::int; end if;
  end loop;
end;
$$;
revoke all on function public.lotto_roll() from public, anon, authenticated;

/** The prize for a roll on a card of this price: the fixed table, top prize first. */
create function public.lotto_prize(p_price int, p_roll int) returns int
language plpgsql stable security definer set search_path = public
as $$
declare
  acc int := 0;
  pr jsonb;
begin
  for pr in select x from jsonb_array_elements(public.city() -> 'economy' -> 'lotto' -> 'prizes') x order by (x ->> 'times')::int desc loop
    acc := acc + (pr ->> 'per100k')::int;
    if p_roll < acc then return (pr ->> 'times')::int * p_price; end if;
  end loop;
  return 0;
end;
$$;
revoke all on function public.lotto_prize(int, int) from public, anon, authenticated;

/** Today's free cards: one, plus beginner's luck through the player's first days. */
create function public.lotto_free_today(p_created timestamptz) returns int
language sql stable security definer set search_path = public
as $$
  select (l ->> 'freePerDay')::int
    + case when public.game_now() < p_created + make_interval(days => (l -> 'beginner' ->> 'days')::int)
           then (l -> 'beginner' ->> 'extraPerDay')::int else 0 end
  from (select public.city() -> 'economy' -> 'lotto' as l) s
$$;
revoke all on function public.lotto_free_today(timestamptz) from public, anon, authenticated;

/** The New York week (its Monday) on the game clock. */
create function public.ny_week() returns date
language sql stable security definer set search_path = public
as $$ select date_trunc('week', public.game_now() at time zone 'America/New_York')::date $$;

/** Buy a card at the counter you're at. The prize is drawn now and kept until it's scratched. */
create function public.buy_lotto_card(p_place text, p_game text, p_free boolean)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  l jsonb := public.city() -> 'economy' -> 'lotto';
  place jsonb := (select p from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = p_place);
  game jsonb := (select x from jsonb_array_elements(l -> 'games') x where x ->> 'id' = p_game);
  today date := public.ny_today();
  me public.players;
  v_price int;
  v_paid int := 0;
  v_cut numeric := 0;
  n int;
  card bigint;
begin
  if place is null or not (place -> 'tags') ?| array(select jsonb_array_elements_text(l -> 'tags')) then
    raise exception 'unknown_action' using errcode = '22023';
  end if;
  if game is null then raise exception 'lotto_unknown_game' using errcode = '22023'; end if;
  v_price := (game ->> 'price')::int;
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.at_place is distinct from p_place then raise exception 'lotto_not_here' using errcode = '22023'; end if;
  if coalesce(p_free, false) then
    if p_game is distinct from l ->> 'freeGame' then raise exception 'lotto_not_free_game' using errcode = '22023'; end if;
    select count(*) into n from public.lotto_cards where player_id = uid and ny_date = today and paid = 0;
    if n >= public.lotto_free_today(me.created_at) then raise exception 'lotto_free_used' using errcode = '22023'; end if;
  else
    select count(*) into n from public.lotto_cards where player_id = uid and ny_date = today and paid > 0;
    if n >= (l ->> 'buyPerDay')::int then raise exception 'lotto_daily_cap' using errcode = '22023'; end if;
    if me.bank_cash < v_price then raise exception 'lotto_cant_afford' using errcode = '22023'; end if;
    v_paid := v_price;
    v_cut := round(v_price * (l -> 'jackpot' ->> 'cut')::numeric, 2);
  end if;
  insert into public.lotto_cards (player_id, game, price, paid, prize, jackpot_cut, ny_date, week, bought_at)
  values (uid, p_game, v_price, v_paid, public.lotto_prize(v_price, public.lotto_roll()), v_cut, today, public.ny_week(), public.game_now())
  returning id into card;
  if v_paid > 0 then
    update public.players set bank_cash = bank_cash - v_paid where id = uid;
    perform public.ledger_once(uid, 'cash', -v_paid, 'lotto_card', p_game || ':' || card);
  end if;
  return jsonb_build_object('id', card, 'game', p_game, 'cash', -v_paid);
end;
$$;

/** Scratch one of your cards: the server reveals the prize drawn at purchase and pays it, once. */
create function public.scratch_lotto_card(p_card bigint)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c public.lotto_cards;
begin
  select * into c from public.lotto_cards where id = p_card and player_id = uid for update;
  if c.id is null then raise exception 'lotto_unknown_card' using errcode = '22023'; end if;
  if c.scratched_at is not null then raise exception 'lotto_already_scratched' using errcode = '22023'; end if;
  update public.lotto_cards set scratched_at = public.game_now() where id = c.id;
  if c.prize > 0 then
    update public.players set bank_cash = bank_cash + c.prize where id = uid;
    perform public.ledger_once(uid, 'cash', c.prize, 'lotto_prize', c.game || ':' || c.id);
  end if;
  return jsonb_build_object('id', c.id, 'game', c.game, 'prize', c.prize, 'cash', c.prize);
end;
$$;

/** The counter's numbers for me: today's cards, this week's jackpot, and cards I haven't scratched. */
create function public.lotto_state()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  l jsonb := public.city() -> 'economy' -> 'lotto';
  today date := public.ny_today();
  wk date := public.ny_week();
  me public.players;
  until timestamptz;
begin
  select * into me from public.players where id = uid;
  if me.id is null then return null; end if;
  until := me.created_at + make_interval(days => (l -> 'beginner' ->> 'days')::int);
  return jsonb_build_object(
    'freeUsed', (select count(*) from public.lotto_cards where player_id = uid and ny_date = today and paid = 0),
    'freeToday', public.lotto_free_today(me.created_at),
    'bought', (select count(*) from public.lotto_cards where player_id = uid and ny_date = today and paid > 0),
    'beginnerUntil', case when public.game_now() < until then until end,
    'week', jsonb_build_object(
      'start', wk,
      'pool', floor((l -> 'jackpot' ->> 'seed')::numeric + coalesce((select sum(jackpot_cut) from public.lotto_cards where week = wk), 0))::int,
      'entries', (select count(*) from public.lotto_cards where player_id = uid and week = wk)),
    'unscratched', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'game', game) order by id)
                             from public.lotto_cards where player_id = uid and scratched_at is null), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.ny_week() from public, anon, authenticated;
revoke all on function public.buy_lotto_card(text, text, boolean) from public, anon;
grant execute on function public.buy_lotto_card(text, text, boolean) to authenticated;
revoke all on function public.scratch_lotto_card(bigint) from public, anon;
grant execute on function public.scratch_lotto_card(bigint) to authenticated;
revoke all on function public.lotto_state() from public, anon;
grant execute on function public.lotto_state() to authenticated;
