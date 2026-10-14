-- v0.11 Lucky Star pots (owner, Oct 14; testing-feedback #5). They replace the weekly jackpot draw (0033).
--
-- "There should be a number for each pot; players play to reveal their number and see if it matches.
-- The smaller games should be daily, the bigger pots weekly." Instant number matching (owner):
--   * Every game has a lucky number (1 to luckyMax) and a pot, in lotto_pots: the C$5, C$10 and C$20
--     games get a new number and a fresh pot every midnight in New York, the C$50 and C$100 games every
--     Monday. Pots start at C$5,000 / 10,000 / 15,000 / 50,000 / 100,000 and are won 1 card in 5,000 /
--     10,000 / 20,000 / 50,000 / 100,000 (harder for every game). 10% of every bought card goes into
--     its game's pot. After a win the pot starts again from its seed; an unwon pot ends with its day or
--     week (that money leaves the game).
--   * A card shows the player's 6 numbers, each with a prize. The prize table is unchanged (the same
--     for every game, about 1 card in 3 wins): a prize puts the lucky number in one cell with that
--     prize; a pot win puts a star (0) in a cell with the pot. Both are drawn when the card is bought,
--     with the cryptographic random source, and kept out of reach until it's scratched, as in 0032.
--     Scratching pays the prize (ledger lotto_prize) and the pot (ledger lotto_pot), once per card.
--   * The weekly draw retires: any finished week not yet drawn is drawn now, and this week's jackpot
--     money (10% of the cards bought so far) moves into the Main Character pot. lotto_settle() stays
--     as a no-op for deployed pages that still call it.

update public.game_settings set value = '{"economy":{"shiftRate":120,"cloutPerDollar":0.25,"baseVisitClout":5,"cloutMultiplier":{"base":0.7,"mood":0.3,"confidence":0.3},"energy":{"dailyTopUp":20,"eventCost":20},"confidenceDriftPerDay":3,"dailyTasks":{"count":5,"rewardMin":25,"rewardMax":50,"bonus":100},"sellRate":0.6,"purchaseCloutDecay":0.85,"bills":{"every":"7 days","carRentalDays":7,"phone":60,"graceDays":2,"moodDropPerDay":8,"evictAfterDays":6,"carInsuranceRate":0.005},"gigs":{"side":{"confidence":0,"clout":0,"chance":0.9,"payMin":2,"payMax":3,"energy":1.5,"waitMinutes":60},"pro":{"confidence":50,"clout":500,"chance":0.5,"payMin":5,"payMax":6,"energy":2,"waitMinutes":120},"big":{"confidence":80,"clout":2000,"chance":0.22,"payMin":10,"payMax":12,"energy":3,"waitMinutes":240}},"shiftEnergy":25,"shiftsPerDay":3,"rest":{"nap":{"energy":30,"mood":0,"perDay":2,"seconds":8},"sit":{"energy":10,"mood":6,"perDay":3,"seconds":4}},"barDrink":{"price":60,"energy":20,"tags":["club","lounge"]},"groceries":{"fridgeMax":10,"cook":{"energy":25,"seconds":6},"tags":["supermarket"],"bundles":[{"id":"snack-run","emoji":"🥪","label":"Snack run","price":28,"meals":2,"blurb":"Chips, hummus, one sad apple. Technically two meals."},{"id":"meal-prep","emoji":"🥦","label":"Meal prep for the week","price":95,"meals":7,"blurb":"Seven containers, one Sunday, infinite smugness."}]},"travel":{"bandsMiles":[0.5,2,5],"walk":{"energy":[5,10,20,null]},"subway":{"fare":6},"taxi":{"fare":[18,35,60,95]},"time":{"walk":{"base":6,"perMile":20,"max":60},"subway":{"base":12,"perMile":6,"max":45},"taxi":{"base":5,"perMile":9,"max":60},"car":{"base":5,"perMile":8,"max":55}},"skip":{"secondsPerCash":2,"min":5}},"hunt":{"cash":1080,"clout":250,"retryMinutes":10,"badgeAfter":4},"gossip":{"pieces":5,"storiesPerWeek":{"min":3,"max":5},"liveDays":14,"clout":25,"mood":6,"badgeAfter":5,"tasksPerDay":2},"lotto":{"tags":["lotto"],"freeGame":"corner-store","freePerDay":1,"beginner":{"days":7,"extraPerDay":1},"buyPerDay":5,"potCut":0.1,"luckyMax":40,"cells":6,"prizes":[{"times":1,"per100k":20000},{"times":2,"per100k":10000},{"times":5,"per100k":2500},{"times":20,"per100k":250},{"times":100,"per100k":20},{"times":1000,"per100k":1}],"bigFrom":100,"games":[{"id":"corner-store","name":"Corner Store Classic","price":5,"color":"#40B589","period":"day","pot":{"seed":5000,"oneIn":5000},"blurb":"The one your uncle buys with exact change."},{"id":"bodega-cat","name":"Bodega Cat Bonanza","price":10,"color":"#3E8EDE","period":"day","pot":{"seed":10000,"oneIn":10000},"blurb":"The cat picked the numbers. The cat has never been wrong."},{"id":"rents-due","name":"Rent''s Due","price":20,"color":"#FF2E88","period":"day","pot":{"seed":15000,"oneIn":20000},"blurb":"Financial planning, but make it shiny."},{"id":"penthouse-dreams","name":"Penthouse Dreams","price":50,"color":"#7A4FD6","period":"week","pot":{"seed":50000,"oneIn":50000},"blurb":"Scratch here to see the view. The view is the counter."},{"id":"main-character","name":"Main Character","price":100,"color":"#2A2530","period":"week","pot":{"seed":100000,"oneIn":100000},"blurb":"For people who are sure the plot is about them."}]}},"places":[{"id":"velvet-static","tags":["club","nightlife","first_party_venue"],"story":null,"at":[40.7465,-73.9455],"area":"Long Island City","actions":[{"id":"visit","kind":"visit","price":140,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"grind-and-gossip","tags":["cafe","dining_medium","job_barista"],"story":null,"at":[40.7645,-73.9225],"area":"Astoria","actions":[{"id":"eat","kind":"eat","price":42,"pay":0,"energy":-30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"shift","kind":"shift","price":0,"pay":120,"energy":25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"lucky-seven-deli","tags":["bodega","dining_budget"],"story":null,"at":[40.7495,-73.8885],"area":"Jackson Heights","actions":[{"id":"eat","kind":"eat","price":16,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"altitude-718","tags":["rooftop","dining_luxury"],"story":null,"at":[40.7425,-73.9555],"area":"Long Island City","actions":[{"id":"eat","kind":"eat","price":210,"pay":0,"energy":-55,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"flushing-meadows","tags":["park","outdoors"],"story":null,"at":[40.742,-73.844],"area":"Flushing Meadows","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pedal-pushers","tags":["delivery_hub","job_delivery"],"story":null,"at":[40.759,-73.928],"area":"Astoria","actions":[{"id":"shift","kind":"shift","price":0,"pay":135,"energy":30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skybridge-tower","tags":["office","gigs_board"],"story":null,"at":[40.7495,-73.9395],"area":"Long Island City","actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skyline-pier","tags":["skyline_pier","residential","waterfront"],"story":"sarah-bird","at":[40.7478,-73.9592],"area":"Long Island City","actions":[{"id":"lobby","kind":"visit","price":0,"pay":0,"energy":5,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"memorial","kind":"visit","price":0,"pay":0,"energy":2,"mood":4,"confidence":0,"clout":10,"storyUnlock":true}]},{"id":"hunters-pier","tags":["hunters_pier","waterfront","park"],"story":"sarah-bird","at":[40.7432,-73.9612],"area":"Long Island City","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rockaway-diner","tags":["rockaway_diner","diner","dining_budget"],"story":"sarah-bird","at":[40.7712,-73.9158],"area":"Astoria","actions":[{"id":"eat","kind":"eat","price":32,"pay":0,"energy":-25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"radiant-harbor","tags":["radiant_harbor","church"],"story":"sarah-bird","at":[40.7738,-73.9296],"area":"Astoria","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pressed-iron-gym","tags":["pressed_iron","gym"],"story":"sarah-bird","at":[40.7662,-73.9118],"area":"Astoria","actions":[{"id":"workout","kind":"visit","price":35,"pay":0,"energy":20,"mood":3,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"unisphere","tags":["monument","park"],"story":null,"at":[40.7466,-73.8448],"area":"Flushing Meadows","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":20,"storyUnlock":false},{"id":"tour","kind":"hangout","price":35,"pay":0,"energy":8,"mood":0,"confidence":5,"clout":null,"storyUnlock":false},{"id":"wish","kind":"hangout","price":2,"pay":0,"energy":0,"mood":4,"confidence":0,"clout":null,"storyUnlock":false},{"id":"pretzel","kind":"eat","price":12,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"people","kind":"hangout","price":0,"pay":0,"energy":3,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"gantry-plaza","tags":["monument","waterfront"],"story":null,"at":[40.7454,-73.9584],"area":"Long Island City","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":20,"storyUnlock":false},{"id":"photoshoot","kind":"hangout","price":0,"pay":0,"energy":10,"mood":0,"confidence":6,"clout":null,"storyUnlock":false},{"id":"picnic","kind":"eat","price":28,"pay":0,"energy":-20,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"ferries","kind":"hangout","price":0,"pay":0,"energy":2,"mood":7,"confidence":0,"clout":null,"storyUnlock":false},{"id":"run","kind":"hangout","price":0,"pay":0,"energy":15,"mood":4,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"low-light-lounge","tags":["lounge","nightlife","exclusive_venue"],"story":null,"at":[40.7612,-73.9175],"area":"Astoria","actions":[{"id":"visit","kind":"visit","price":105,"pay":0,"energy":10,"mood":8,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"thread-count","tags":["boutique","shopping","fashion"],"story":null,"at":[40.7651,-73.9204],"area":"Astoria","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"boulevard-motors","tags":["dealership","shopping","cars"],"story":null,"at":[40.7503,-73.9372],"area":"Long Island City","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"st-johnsons","tags":["university","campus"],"story":null,"at":[40.7224,-73.7949],"area":"Jamaica","actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false}]},{"id":"queensborough-u","tags":["university","campus"],"story":null,"at":[40.7366,-73.817],"area":"Flushing","actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false}]},{"id":"ditmars-deli","tags":["bodega","dining_budget","astoria"],"story":null,"at":[40.7748,-73.9128],"area":"Astoria","actions":[{"id":"eat","kind":"eat","price":14,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"two-bros-pizza","tags":["pizza","dining_budget","astoria"],"story":null,"at":[40.7668,-73.9208],"area":"Astoria","actions":[{"id":"eat","kind":"eat","price":9,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"neon-spoon","tags":["diner","dining_medium","astoria"],"story":null,"at":[40.7695,-73.9265],"area":"Astoria","actions":[{"id":"eat","kind":"eat","price":38,"pay":0,"energy":-28,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"up-on-thirty","tags":["rooftop","dining_luxury","astoria"],"story":null,"at":[40.7672,-73.9238],"area":"Astoria","actions":[{"id":"eat","kind":"eat","price":160,"pay":0,"energy":-50,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"steinway-fresh","tags":["supermarket","astoria"],"story":null,"at":[40.7628,-73.916],"area":"Astoria","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"hellgate-hall","tags":["club","nightlife","astoria"],"story":null,"at":[40.7737,-73.9178],"area":"Astoria","actions":[{"id":"visit","kind":"visit","price":115,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"triborough-works","tags":["office","coworking","gigs_board","astoria"],"story":null,"at":[40.766,-73.9252],"area":"Astoria","actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"ditmars-library","tags":["library","free","astoria"],"story":null,"at":[40.7735,-73.9098],"area":"Astoria","actions":[{"id":"study","kind":"visit","price":0,"pay":0,"energy":10,"mood":0,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"precinct-114-half","tags":["police","free","astoria"],"story":null,"at":[40.769,-73.9228],"area":"Astoria","actions":[{"id":"report","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"engine-7","tags":["firehouse","free","astoria"],"story":null,"at":[40.772,-73.9205],"area":"Astoria","actions":[{"id":"pet-dog","kind":"visit","price":0,"pay":0,"energy":2,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"astoria-cc","tags":["college","campus","astoria"],"story":null,"at":[40.76,-73.9232],"area":"Astoria","actions":[{"id":"night-class","kind":"visit","price":45,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":10,"storyUnlock":false}]},{"id":"harmony-chapel","tags":["chapel","quiet","free","astoria"],"story":null,"at":[40.7652,-73.913],"area":"Astoria","actions":[{"id":"quiet","kind":"visit","price":0,"pay":0,"energy":2,"mood":7,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"hell-gate-park","tags":["park","outdoors","free","astoria"],"story":null,"at":[40.779,-73.9232],"area":"Astoria","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rep-count","tags":["gym","astoria"],"story":null,"at":[40.764,-73.9146],"area":"Astoria","actions":[{"id":"workout","kind":"visit","price":28,"pay":0,"energy":20,"mood":2,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"astoria-blvd-station","tags":["subway","transit","free","astoria"],"story":null,"at":[40.7702,-73.918],"area":"Astoria","actions":[{"id":"platform","kind":"visit","price":0,"pay":0,"energy":2,"mood":2,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"reel-queens","tags":["cinema","date_spot","astoria"],"story":null,"at":[40.7605,-73.9196],"area":"Astoria","actions":[{"id":"movie","kind":"eat","price":35,"pay":0,"energy":-10,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"respawn-arena","tags":["games","arena","astoria"],"story":null,"at":[40.7708,-73.9105],"area":"Astoria","actions":[{"id":"match","kind":"visit","price":24,"pay":0,"energy":15,"mood":0,"confidence":5,"clout":12,"storyUnlock":false}]},{"id":"lucky-star","tags":["lotto","flushing"],"story":null,"at":[40.7593,-73.8301],"area":"Flushing","actions":[{"id":"chat","kind":"visit","price":0,"pay":0,"energy":2,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]}],"events":[{"id":"neon-nights","placeId":"velvet-static","startHour":22,"hours":5,"entry":185,"clout":60,"confidence":8,"mood":6},{"id":"bass-bath","placeId":"hellgate-hall","startHour":21,"hours":5,"entry":160,"clout":50,"confidence":7,"mood":7},{"id":"golden-hour","placeId":"velvet-static","startHour":15,"hours":4,"entry":115,"clout":40,"confidence":6,"mood":8},{"id":"homecoming-tailgate","placeId":"st-johnsons","startHour":16,"hours":4,"entry":35,"clout":35,"confidence":4,"mood":10},{"id":"quad-open-mic","placeId":"queensborough-u","startHour":19,"hours":3,"entry":24,"clout":30,"confidence":8,"mood":6}],"gigs":{"side":["Be a professional crowd at a gallery opening","Stand in line for a sneaker drop","Laugh on cue at a comedy open mic","Hold a ring light at a rooftop shoot"],"pro":["Run a launch campaign for a $14 artisanal ice cube startup","Ghost-write a podcast host''s \"authentic\" origin story","Manage socials for a dog with 40k followers"],"big":["Write a speech for a councilmember candidate","Art-direct a perfume ad for a fictional heiress"]},"shop":[{"sku":"fit-satin-bomber","category":"fashion","price":395,"clout":25,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false},{"sku":"fit-leather-blazer","category":"fashion","price":925,"clout":45,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false},{"sku":"fit-varsity-tee","category":"fashion","price":145,"clout":10,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false},{"sku":"fit-wide-trousers","category":"fashion","price":310,"clout":18,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false},{"sku":"fit-mini-skirt","category":"fashion","price":265,"clout":16,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false},{"sku":"fit-chunky-sneakers","category":"fashion","price":460,"clout":28,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":false},{"sku":"forever-our-bird-hoodie","category":"fashion","price":185,"clout":12,"rentPerWeek":0,"slot":"top","storyOnly":true,"collector":false},{"sku":"col-faux-chinchilla","category":"fashion","price":0,"clout":80,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":true},{"sku":"col-holo-boots","category":"fashion","price":0,"clout":70,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":true},{"sku":"fit-bucket-hat","category":"fashion","price":120,"clout":8,"rentPerWeek":0,"slot":"accessory","storyOnly":false,"collector":false},{"sku":"car-hatchback","category":"cars","price":21000,"clout":120,"rentPerWeek":525,"slot":null,"storyOnly":false,"collector":false},{"sku":"car-luxury-sedan","category":"cars","price":78000,"clout":300,"rentPerWeek":1350,"slot":null,"storyOnly":false,"collector":false},{"sku":"car-electric-coupe","category":"cars","price":117000,"clout":420,"rentPerWeek":1950,"slot":null,"storyOnly":false,"collector":false},{"sku":"house-astoria-townhouse","category":"houses","price":270000,"clout":900,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"house-lic-penthouse","category":"houses","price":975000,"clout":2400,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"lux-gold-chain","category":"luxury","price":2250,"clout":70,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"lux-diamond-studs","category":"luxury","price":6000,"clout":140,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"lux-designer-watch","category":"luxury","price":17000,"clout":260,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"mu-glow-kit","category":"makeup","price":165,"clout":12,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"mu-lip-set","category":"makeup","price":210,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"mu-lash-bar","category":"makeup","price":350,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false}],"homeLocations":{"astoria_studio":[40.7745,-73.905],"jackson_heights_1br":[40.752,-73.883],"lic_highrise":[40.747,-73.956]}}'::jsonb, updated_at = now() where key = 'city';

create table public.lotto_pots (
  game    text not null,
  -- The day (daily games) or the Monday (weekly games) this pot and number run for, in New York.
  period  date not null,
  lucky   int not null check (lucky > 0),
  pool    numeric(12, 2) not null,
  primary key (game, period)
);
alter table public.lotto_pots enable row level security;
revoke all on public.lotto_pots from anon, authenticated;

create table public.lotto_pot_wins (
  id        bigint generated always as identity primary key,
  game      text not null,
  period    date not null,
  amount    int not null check (amount > 0),
  player_id uuid references public.players (id) on delete set null,
  card      bigint not null unique,
  won_at    timestamptz not null default now()
);
alter table public.lotto_pot_wins enable row level security;
revoke all on public.lotto_pot_wins from anon, authenticated;

alter table public.lotto_cards
  add column lucky int,
  add column numbers jsonb,
  add column pot int not null default 0 check (pot >= 0);

/** The day or week a game's pot runs for right now. */
create function public.lotto_period(p_game jsonb) returns date
language sql stable security definer set search_path = public
as $$ select case when p_game ->> 'period' = 'week' then public.ny_week() else public.ny_today() end $$;
revoke all on function public.lotto_period(jsonb) from public, anon, authenticated;

/** Makes sure a game has its pot for this day or week (a new lucky number, the seed), and returns it. */
create function public.lotto_pot_for(p_game jsonb) returns public.lotto_pots
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_period date := public.lotto_period(p_game);
  r public.lotto_pots;
begin
  insert into public.lotto_pots (game, period, lucky, pool)
  values (p_game ->> 'id', v_period, 1 + public.lotto_rand((public.city() -> 'economy' -> 'lotto' ->> 'luckyMax')::int),
          (p_game -> 'pot' ->> 'seed')::numeric)
  on conflict do nothing;
  select * into r from public.lotto_pots where game = p_game ->> 'id' and period = v_period;
  return r;
end;
$$;
revoke all on function public.lotto_pot_for(jsonb) from public, anon, authenticated;

/** The player's numbers on a card (cardCells in lib/lotto.ts lays them out the same way). */
create function public.lotto_numbers(p_price int, p_prize int, p_pot int, p_lucky int) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  l jsonb := public.city() -> 'economy' -> 'lotto';
  n_cells int := (l ->> 'cells')::int;
  lmax int := (l ->> 'luckyMax')::int;
  decoys int[] := array(select (x ->> 'times')::int * p_price from jsonb_array_elements(l -> 'prizes') x where (x ->> 'times')::int <= 100 order by (x ->> 'times')::int);
  nums int[] := '{}';
  prizes int[] := '{}';
  v int;
  at int;
begin
  while coalesce(array_length(nums, 1), 0) < n_cells loop
    v := 1 + public.lotto_rand(lmax);
    if v = p_lucky or v = any(nums) then continue; end if;
    nums := nums || v;
    prizes := prizes || decoys[1 + public.lotto_rand(array_length(decoys, 1))];
  end loop;
  at := 1 + public.lotto_rand(n_cells);
  if p_prize > 0 then nums[at] := p_lucky; prizes[at] := p_prize; end if;
  if p_pot > 0 then
    if p_prize > 0 then at := 1 + ((at + public.lotto_rand(n_cells - 1)) % n_cells); end if;
    nums[at] := 0; prizes[at] := p_pot;
  end if;
  return (select jsonb_agg(jsonb_build_object('n', nums[i], 'prize', prizes[i]) order by i) from generate_series(1, n_cells) i);
end;
$$;
revoke all on function public.lotto_numbers(int, int, int, int) from public, anon, authenticated;

/** Buy a card at the counter you're at (0032's rules). The prize, the pot and the numbers are drawn now. */
create or replace function public.buy_lotto_card(p_place text, p_game text, p_free boolean)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  l jsonb := public.city() -> 'economy' -> 'lotto';
  place jsonb := (select p from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = p_place);
  v_game jsonb := (select x from jsonb_array_elements(l -> 'games') x where x ->> 'id' = p_game);
  today date := public.ny_today();
  me public.players;
  v_pot_row public.lotto_pots;
  v_price int;
  v_paid int := 0;
  v_cut numeric := 0;
  v_prize int;
  v_pot int := 0;
  n int;
  card bigint;
begin
  if place is null or not (place -> 'tags') ?| array(select jsonb_array_elements_text(l -> 'tags')) then
    raise exception 'unknown_action' using errcode = '22023';
  end if;
  if v_game is null then raise exception 'lotto_unknown_game' using errcode = '22023'; end if;
  v_price := (v_game ->> 'price')::int;
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
    v_cut := round(v_price * (l ->> 'potCut')::numeric, 2);
  end if;
  -- The pot row is locked while this card is decided, so two cards can't both take it.
  perform public.lotto_pot_for(v_game);
  select * into v_pot_row from public.lotto_pots where lotto_pots.game = p_game and lotto_pots.period = public.lotto_period(v_game) for update;
  update public.lotto_pots set pool = pool + v_cut where lotto_pots.game = v_pot_row.game and lotto_pots.period = v_pot_row.period returning * into v_pot_row;
  v_prize := public.lotto_prize(v_price, public.lotto_roll());
  if public.lotto_rand((v_game -> 'pot' ->> 'oneIn')::int) = 0 then
    v_pot := floor(v_pot_row.pool)::int;
    update public.lotto_pots set pool = (v_game -> 'pot' ->> 'seed')::numeric where lotto_pots.game = v_pot_row.game and lotto_pots.period = v_pot_row.period;
  end if;
  insert into public.lotto_cards (player_id, game, price, paid, prize, jackpot_cut, ny_date, week, bought_at, lucky, numbers, pot)
  values (uid, p_game, v_price, v_paid, v_prize, 0, today, public.ny_week(), public.game_now(), v_pot_row.lucky,
          public.lotto_numbers(v_price, v_prize, v_pot, v_pot_row.lucky), v_pot)
  returning id into card;
  if v_pot > 0 then
    insert into public.lotto_pot_wins (game, period, amount, player_id, card, won_at) values (p_game, v_pot_row.period, v_pot, uid, card, public.game_now());
  end if;
  if v_paid > 0 then
    update public.players set bank_cash = bank_cash - v_paid where id = uid;
    perform public.ledger_once(uid, 'cash', -v_paid, 'lotto_card', p_game || ':' || card);
  end if;
  return jsonb_build_object('id', card, 'game', p_game, 'cash', -v_paid);
end;
$$;

/** Scratch one of your cards: the server reveals its numbers and pays the prize and the pot, once. */
create or replace function public.scratch_lotto_card(p_card bigint)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c public.lotto_cards;
  v_game jsonb;
begin
  select * into c from public.lotto_cards where id = p_card and player_id = uid for update;
  if c.id is null then raise exception 'lotto_unknown_card' using errcode = '22023'; end if;
  if c.scratched_at is not null then raise exception 'lotto_already_scratched' using errcode = '22023'; end if;
  -- A card bought before 0041 gets numbers that show the prize it already had.
  if c.numbers is null then
    v_game := (select x from jsonb_array_elements(public.city() -> 'economy' -> 'lotto' -> 'games') x where x ->> 'id' = c.game);
    c.lucky := coalesce(c.lucky, (public.lotto_pot_for(v_game)).lucky);
    c.numbers := public.lotto_numbers(c.price, c.prize, 0, c.lucky);
  end if;
  update public.lotto_cards set scratched_at = public.game_now(), lucky = c.lucky, numbers = c.numbers where id = c.id;
  if c.prize > 0 then
    update public.players set bank_cash = bank_cash + c.prize where id = uid;
    perform public.ledger_once(uid, 'cash', c.prize, 'lotto_prize', c.game || ':' || c.id);
  end if;
  if c.pot > 0 then
    update public.players set bank_cash = bank_cash + c.pot where id = uid;
    perform public.ledger_once(uid, 'cash', c.pot, 'lotto_pot', c.game || ':' || c.id);
    insert into public.player_badges (player_id, badge_id, arc_id) values (uid, 'lotto-jackpot', 'lotto:' || c.id) on conflict do nothing;
  end if;
  return jsonb_build_object('id', c.id, 'game', c.game, 'prize', c.prize, 'pot', c.pot, 'lucky', c.lucky,
                            'numbers', c.numbers, 'cash', c.prize + c.pot);
end;
$$;

/** The counter for me: today's cards, every game's number and pot, cards I haven't scratched, recent pot wins. */
create or replace function public.lotto_state()
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  l jsonb := public.city() -> 'economy' -> 'lotto';
  today date := public.ny_today();
  me public.players;
  until timestamptz;
  g jsonb;
begin
  select * into me from public.players where id = uid;
  if me.id is null then return null; end if;
  until := me.created_at + make_interval(days => (l -> 'beginner' ->> 'days')::int);
  for g in select x from jsonb_array_elements(l -> 'games') x loop perform public.lotto_pot_for(g); end loop;
  return jsonb_build_object(
    'freeUsed', (select count(*) from public.lotto_cards where player_id = uid and ny_date = today and paid = 0),
    'freeToday', public.lotto_free_today(me.created_at),
    'bought', (select count(*) from public.lotto_cards where player_id = uid and ny_date = today and paid > 0),
    'beginnerUntil', case when public.game_now() < until then until end,
    'pots', (select jsonb_agg(jsonb_build_object('game', p.game, 'lucky', p.lucky, 'pool', floor(p.pool)::int, 'period', p.period) order by x.ord)
               from jsonb_array_elements(l -> 'games') with ordinality x(g, ord)
               join public.lotto_pots p on p.game = x.g ->> 'id' and p.period = public.lotto_period(x.g)),
    'unscratched', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'game', game) order by id)
                             from public.lotto_cards where player_id = uid and scratched_at is null), '[]'::jsonb),
    -- Only pots already scratched: a win shows up once its card is.
    'wins', coalesce((select jsonb_agg(x order by x ->> 'wonAt' desc) from (
        select jsonb_build_object(
                 'game', w.game, 'amount', w.amount, 'wonAt', w.won_at, 'mine', w.player_id = uid,
                 'winner', case when w.player_id = uid then p.display_name when coalesce(p.news_opt_out, false) then null else p.display_name end) as x
          from public.lotto_pot_wins w
          join public.lotto_cards c on c.id = w.card and c.scratched_at is not null
          left join public.players p on p.id = w.player_id
         order by w.won_at desc limit 3) s), '[]'::jsonb)
  );
end;
$$;

-- Retire the weekly draw: settle any finished week, then move this week's jackpot money into the
-- Main Character pot (a new pot row for this week, with the seed plus that money).
select public.lotto_settle();
insert into public.lotto_pots (game, period, lucky, pool)
select 'main-character', public.ny_week(), 1 + public.lotto_rand((public.city() -> 'economy' -> 'lotto' ->> 'luckyMax')::int),
       (x -> 'pot' ->> 'seed')::numeric + coalesce((select sum(jackpot_cut) from public.lotto_cards where week = public.ny_week()), 0)
  from jsonb_array_elements(public.city() -> 'economy' -> 'lotto' -> 'games') x where x ->> 'id' = 'main-character'
on conflict do nothing;
update public.lotto_cards set jackpot_cut = 0 where week = public.ny_week();

create or replace function public.lotto_settle()
returns int
language sql security definer set search_path = public
as $$ select 0 $$;
