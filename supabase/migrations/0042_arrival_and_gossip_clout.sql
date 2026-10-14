-- Owner, Oct 14 (follow-ups to testing round fixes A and B).
--   * Waiting for arrival everywhere: resting, cooking, groceries, the bar and the lotto now also say
--     'still_travelling' until the trip's time is up (0040 covered place actions and events through
--     require_here). Each function is its earlier body plus that one check, after the place check.
--   * "Why reward cash for information? Should reward with clout": daily tasks that send the player
--     along the gossip trail (kind 'gossip', 0036) pay gossip.taskClout clout instead of cash (ledger
--     'clout' kind 'daily_task', ref the task). Other tasks and the daily bonus still pay cash. The
--     seed gains gossip.taskClout (15).

update public.game_settings set value = '{"economy":{"shiftRate":120,"cloutPerDollar":0.25,"baseVisitClout":5,"cloutMultiplier":{"base":0.7,"mood":0.3,"confidence":0.3},"energy":{"dailyTopUp":20,"eventCost":20},"confidenceDriftPerDay":3,"dailyTasks":{"count":5,"rewardMin":25,"rewardMax":50,"bonus":100},"sellRate":0.6,"purchaseCloutDecay":0.85,"bills":{"every":"7 days","carRentalDays":7,"phone":60,"graceDays":2,"moodDropPerDay":8,"evictAfterDays":6,"carInsuranceRate":0.005},"gigs":{"side":{"confidence":0,"clout":0,"chance":0.9,"payMin":2,"payMax":3,"energy":1.5,"waitMinutes":60},"pro":{"confidence":50,"clout":500,"chance":0.5,"payMin":5,"payMax":6,"energy":2,"waitMinutes":120},"big":{"confidence":80,"clout":2000,"chance":0.22,"payMin":10,"payMax":12,"energy":3,"waitMinutes":240}},"shiftEnergy":25,"shiftsPerDay":3,"rest":{"nap":{"energy":30,"mood":0,"perDay":2,"seconds":8},"sit":{"energy":10,"mood":6,"perDay":3,"seconds":4}},"barDrink":{"price":60,"energy":20,"tags":["club","lounge"]},"groceries":{"fridgeMax":10,"cook":{"energy":25,"seconds":6},"tags":["supermarket"],"bundles":[{"id":"snack-run","emoji":"🥪","label":"Snack run","price":28,"meals":2,"blurb":"Chips, hummus, one sad apple. Technically two meals."},{"id":"meal-prep","emoji":"🥦","label":"Meal prep for the week","price":95,"meals":7,"blurb":"Seven containers, one Sunday, infinite smugness."}]},"travel":{"bandsMiles":[0.5,2,5],"walk":{"energy":[5,10,20,null]},"subway":{"fare":6},"taxi":{"fare":[18,35,60,95]},"time":{"walk":{"base":6,"perMile":20,"max":60},"subway":{"base":12,"perMile":6,"max":45},"taxi":{"base":5,"perMile":9,"max":60},"car":{"base":5,"perMile":8,"max":55}},"skip":{"secondsPerCash":2,"min":5}},"hunt":{"cash":1080,"clout":250,"retryMinutes":10,"badgeAfter":4},"gossip":{"pieces":5,"storiesPerWeek":{"min":3,"max":5},"liveDays":14,"clout":25,"mood":6,"badgeAfter":5,"tasksPerDay":2,"taskClout":15},"lotto":{"tags":["lotto"],"freeGame":"corner-store","freePerDay":1,"beginner":{"days":7,"extraPerDay":1},"buyPerDay":5,"potCut":0.1,"luckyMax":40,"cells":6,"prizes":[{"times":1,"per100k":20000},{"times":2,"per100k":10000},{"times":5,"per100k":2500},{"times":20,"per100k":250},{"times":100,"per100k":20},{"times":1000,"per100k":1}],"bigFrom":100,"games":[{"id":"corner-store","name":"Corner Store Classic","price":5,"color":"#40B589","period":"day","pot":{"seed":5000,"oneIn":5000},"blurb":"The one your uncle buys with exact change."},{"id":"bodega-cat","name":"Bodega Cat Bonanza","price":10,"color":"#3E8EDE","period":"day","pot":{"seed":10000,"oneIn":10000},"blurb":"The cat picked the numbers. The cat has never been wrong."},{"id":"rents-due","name":"Rent''s Due","price":20,"color":"#FF2E88","period":"day","pot":{"seed":15000,"oneIn":20000},"blurb":"Financial planning, but make it shiny."},{"id":"penthouse-dreams","name":"Penthouse Dreams","price":50,"color":"#7A4FD6","period":"week","pot":{"seed":50000,"oneIn":50000},"blurb":"Scratch here to see the view. The view is the counter."},{"id":"main-character","name":"Main Character","price":100,"color":"#2A2530","period":"week","pot":{"seed":100000,"oneIn":100000},"blurb":"For people who are sure the plot is about them."}]}},"places":[{"id":"velvet-static","tags":["club","nightlife","first_party_venue"],"story":null,"at":[40.7465,-73.9455],"area":"Long Island City","actions":[{"id":"visit","kind":"visit","price":140,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"grind-and-gossip","tags":["cafe","dining_medium","job_barista"],"story":null,"at":[40.7645,-73.9225],"area":"Astoria","actions":[{"id":"eat","kind":"eat","price":42,"pay":0,"energy":-30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"shift","kind":"shift","price":0,"pay":120,"energy":25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"lucky-seven-deli","tags":["bodega","dining_budget"],"story":null,"at":[40.7495,-73.8885],"area":"Jackson Heights","actions":[{"id":"eat","kind":"eat","price":16,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"altitude-718","tags":["rooftop","dining_luxury"],"story":null,"at":[40.7425,-73.9555],"area":"Long Island City","actions":[{"id":"eat","kind":"eat","price":210,"pay":0,"energy":-55,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"flushing-meadows","tags":["park","outdoors"],"story":null,"at":[40.742,-73.844],"area":"Flushing Meadows","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pedal-pushers","tags":["delivery_hub","job_delivery"],"story":null,"at":[40.759,-73.928],"area":"Astoria","actions":[{"id":"shift","kind":"shift","price":0,"pay":135,"energy":30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skybridge-tower","tags":["office","gigs_board"],"story":null,"at":[40.7495,-73.9395],"area":"Long Island City","actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skyline-pier","tags":["skyline_pier","residential","waterfront"],"story":"sarah-bird","at":[40.7478,-73.9592],"area":"Long Island City","actions":[{"id":"lobby","kind":"visit","price":0,"pay":0,"energy":5,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"memorial","kind":"visit","price":0,"pay":0,"energy":2,"mood":4,"confidence":0,"clout":10,"storyUnlock":true}]},{"id":"hunters-pier","tags":["hunters_pier","waterfront","park"],"story":"sarah-bird","at":[40.7432,-73.9612],"area":"Long Island City","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rockaway-diner","tags":["rockaway_diner","diner","dining_budget"],"story":"sarah-bird","at":[40.7712,-73.9158],"area":"Astoria","actions":[{"id":"eat","kind":"eat","price":32,"pay":0,"energy":-25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"radiant-harbor","tags":["radiant_harbor","church"],"story":"sarah-bird","at":[40.7738,-73.9296],"area":"Astoria","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pressed-iron-gym","tags":["pressed_iron","gym"],"story":"sarah-bird","at":[40.7662,-73.9118],"area":"Astoria","actions":[{"id":"workout","kind":"visit","price":35,"pay":0,"energy":20,"mood":3,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"unisphere","tags":["monument","park"],"story":null,"at":[40.7466,-73.8448],"area":"Flushing Meadows","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":20,"storyUnlock":false},{"id":"tour","kind":"hangout","price":35,"pay":0,"energy":8,"mood":0,"confidence":5,"clout":null,"storyUnlock":false},{"id":"wish","kind":"hangout","price":2,"pay":0,"energy":0,"mood":4,"confidence":0,"clout":null,"storyUnlock":false},{"id":"pretzel","kind":"eat","price":12,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"people","kind":"hangout","price":0,"pay":0,"energy":3,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"gantry-plaza","tags":["monument","waterfront"],"story":null,"at":[40.7454,-73.9584],"area":"Long Island City","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":20,"storyUnlock":false},{"id":"photoshoot","kind":"hangout","price":0,"pay":0,"energy":10,"mood":0,"confidence":6,"clout":null,"storyUnlock":false},{"id":"picnic","kind":"eat","price":28,"pay":0,"energy":-20,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"ferries","kind":"hangout","price":0,"pay":0,"energy":2,"mood":7,"confidence":0,"clout":null,"storyUnlock":false},{"id":"run","kind":"hangout","price":0,"pay":0,"energy":15,"mood":4,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"low-light-lounge","tags":["lounge","nightlife","exclusive_venue"],"story":null,"at":[40.7612,-73.9175],"area":"Astoria","actions":[{"id":"visit","kind":"visit","price":105,"pay":0,"energy":10,"mood":8,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"thread-count","tags":["boutique","shopping","fashion"],"story":null,"at":[40.7651,-73.9204],"area":"Astoria","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"boulevard-motors","tags":["dealership","shopping","cars"],"story":null,"at":[40.7503,-73.9372],"area":"Long Island City","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"st-johnsons","tags":["university","campus"],"story":null,"at":[40.7224,-73.7949],"area":"Jamaica","actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false}]},{"id":"queensborough-u","tags":["university","campus"],"story":null,"at":[40.7366,-73.817],"area":"Flushing","actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false}]},{"id":"ditmars-deli","tags":["bodega","dining_budget","astoria"],"story":null,"at":[40.7748,-73.9128],"area":"Astoria","actions":[{"id":"eat","kind":"eat","price":14,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"two-bros-pizza","tags":["pizza","dining_budget","astoria"],"story":null,"at":[40.7668,-73.9208],"area":"Astoria","actions":[{"id":"eat","kind":"eat","price":9,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"neon-spoon","tags":["diner","dining_medium","astoria"],"story":null,"at":[40.7695,-73.9265],"area":"Astoria","actions":[{"id":"eat","kind":"eat","price":38,"pay":0,"energy":-28,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"up-on-thirty","tags":["rooftop","dining_luxury","astoria"],"story":null,"at":[40.7672,-73.9238],"area":"Astoria","actions":[{"id":"eat","kind":"eat","price":160,"pay":0,"energy":-50,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"steinway-fresh","tags":["supermarket","astoria"],"story":null,"at":[40.7628,-73.916],"area":"Astoria","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"hellgate-hall","tags":["club","nightlife","astoria"],"story":null,"at":[40.7737,-73.9178],"area":"Astoria","actions":[{"id":"visit","kind":"visit","price":115,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"triborough-works","tags":["office","coworking","gigs_board","astoria"],"story":null,"at":[40.766,-73.9252],"area":"Astoria","actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"ditmars-library","tags":["library","free","astoria"],"story":null,"at":[40.7735,-73.9098],"area":"Astoria","actions":[{"id":"study","kind":"visit","price":0,"pay":0,"energy":10,"mood":0,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"precinct-114-half","tags":["police","free","astoria"],"story":null,"at":[40.769,-73.9228],"area":"Astoria","actions":[{"id":"report","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"engine-7","tags":["firehouse","free","astoria"],"story":null,"at":[40.772,-73.9205],"area":"Astoria","actions":[{"id":"pet-dog","kind":"visit","price":0,"pay":0,"energy":2,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"astoria-cc","tags":["college","campus","astoria"],"story":null,"at":[40.76,-73.9232],"area":"Astoria","actions":[{"id":"night-class","kind":"visit","price":45,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":10,"storyUnlock":false}]},{"id":"harmony-chapel","tags":["chapel","quiet","free","astoria"],"story":null,"at":[40.7652,-73.913],"area":"Astoria","actions":[{"id":"quiet","kind":"visit","price":0,"pay":0,"energy":2,"mood":7,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"hell-gate-park","tags":["park","outdoors","free","astoria"],"story":null,"at":[40.779,-73.9232],"area":"Astoria","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rep-count","tags":["gym","astoria"],"story":null,"at":[40.764,-73.9146],"area":"Astoria","actions":[{"id":"workout","kind":"visit","price":28,"pay":0,"energy":20,"mood":2,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"astoria-blvd-station","tags":["subway","transit","free","astoria"],"story":null,"at":[40.7702,-73.918],"area":"Astoria","actions":[{"id":"platform","kind":"visit","price":0,"pay":0,"energy":2,"mood":2,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"reel-queens","tags":["cinema","date_spot","astoria"],"story":null,"at":[40.7605,-73.9196],"area":"Astoria","actions":[{"id":"movie","kind":"eat","price":35,"pay":0,"energy":-10,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"respawn-arena","tags":["games","arena","astoria"],"story":null,"at":[40.7708,-73.9105],"area":"Astoria","actions":[{"id":"match","kind":"visit","price":24,"pay":0,"energy":15,"mood":0,"confidence":5,"clout":12,"storyUnlock":false}]},{"id":"lucky-star","tags":["lotto","flushing"],"story":null,"at":[40.7593,-73.8301],"area":"Flushing","actions":[{"id":"chat","kind":"visit","price":0,"pay":0,"energy":2,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]}],"events":[{"id":"neon-nights","placeId":"velvet-static","startHour":22,"hours":5,"entry":185,"clout":60,"confidence":8,"mood":6},{"id":"bass-bath","placeId":"hellgate-hall","startHour":21,"hours":5,"entry":160,"clout":50,"confidence":7,"mood":7},{"id":"golden-hour","placeId":"velvet-static","startHour":15,"hours":4,"entry":115,"clout":40,"confidence":6,"mood":8},{"id":"homecoming-tailgate","placeId":"st-johnsons","startHour":16,"hours":4,"entry":35,"clout":35,"confidence":4,"mood":10},{"id":"quad-open-mic","placeId":"queensborough-u","startHour":19,"hours":3,"entry":24,"clout":30,"confidence":8,"mood":6}],"gigs":{"side":["Be a professional crowd at a gallery opening","Stand in line for a sneaker drop","Laugh on cue at a comedy open mic","Hold a ring light at a rooftop shoot"],"pro":["Run a launch campaign for a $14 artisanal ice cube startup","Ghost-write a podcast host''s \"authentic\" origin story","Manage socials for a dog with 40k followers"],"big":["Write a speech for a councilmember candidate","Art-direct a perfume ad for a fictional heiress"]},"shop":[{"sku":"fit-satin-bomber","category":"fashion","price":395,"clout":25,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false},{"sku":"fit-leather-blazer","category":"fashion","price":925,"clout":45,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false},{"sku":"fit-varsity-tee","category":"fashion","price":145,"clout":10,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false},{"sku":"fit-wide-trousers","category":"fashion","price":310,"clout":18,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false},{"sku":"fit-mini-skirt","category":"fashion","price":265,"clout":16,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false},{"sku":"fit-chunky-sneakers","category":"fashion","price":460,"clout":28,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":false},{"sku":"forever-our-bird-hoodie","category":"fashion","price":185,"clout":12,"rentPerWeek":0,"slot":"top","storyOnly":true,"collector":false},{"sku":"col-faux-chinchilla","category":"fashion","price":0,"clout":80,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":true},{"sku":"col-holo-boots","category":"fashion","price":0,"clout":70,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":true},{"sku":"fit-bucket-hat","category":"fashion","price":120,"clout":8,"rentPerWeek":0,"slot":"accessory","storyOnly":false,"collector":false},{"sku":"car-hatchback","category":"cars","price":21000,"clout":120,"rentPerWeek":525,"slot":null,"storyOnly":false,"collector":false},{"sku":"car-luxury-sedan","category":"cars","price":78000,"clout":300,"rentPerWeek":1350,"slot":null,"storyOnly":false,"collector":false},{"sku":"car-electric-coupe","category":"cars","price":117000,"clout":420,"rentPerWeek":1950,"slot":null,"storyOnly":false,"collector":false},{"sku":"house-astoria-townhouse","category":"houses","price":270000,"clout":900,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"house-lic-penthouse","category":"houses","price":975000,"clout":2400,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"lux-gold-chain","category":"luxury","price":2250,"clout":70,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"lux-diamond-studs","category":"luxury","price":6000,"clout":140,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"lux-designer-watch","category":"luxury","price":17000,"clout":260,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"mu-glow-kit","category":"makeup","price":165,"clout":12,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"mu-lip-set","category":"makeup","price":210,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"mu-lash-bar","category":"makeup","price":350,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false}],"homeLocations":{"astoria_studio":[40.7745,-73.905],"jackson_heights_1br":[40.752,-73.883],"lic_highrise":[40.747,-73.956]}}'::jsonb, updated_at = now() where key = 'city';

-- 0013's complete_task, except gossip tasks pay clout. Returns the cash paid, as before.
create or replace function public.complete_task(p_player uuid, p_place text, p_action text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  t record;
  bonus int := (public.city() -> 'economy' -> 'dailyTasks' ->> 'bonus')::int;
  task_clout int := coalesce((public.city() -> 'economy' -> 'gossip' ->> 'taskClout')::int, 0);
  paid int := 0;
begin
  perform public.crew_went(p_player, p_place, p_action);
  select * into t from public.daily_tasks
   where player_id = p_player and ny_date = today and place_id = p_place and action_id = p_action and done_at is null
   order by slot limit 1 for update;
  if t.id is null then return 0; end if;
  update public.daily_tasks set done_at = now() where id = t.id;
  if t.kind = 'gossip' then
    if task_clout > 0 and public.ledger_once(p_player, 'clout', task_clout, 'daily_task', t.id::text) then
      update public.players set clout = clout + task_clout where id = p_player;
    end if;
  elsif public.ledger_once(p_player, 'cash', t.reward, 'daily_task', t.id::text) then
    update public.players set bank_cash = bank_cash + t.reward where id = p_player;
    paid := t.reward;
  end if;
  if not exists (select 1 from public.daily_tasks where player_id = p_player and ny_date = today and done_at is null)
     and public.ledger_once(p_player, 'cash', bonus, 'daily_bonus', today::text) then
    update public.players set bank_cash = bank_cash + bonus where id = p_player;
    paid := paid + bonus;
  end if;
  return paid;
end;
$$;

-- Gossip tasks show their clout: set today's open ones to the clout they now pay.
update public.daily_tasks set reward = coalesce((public.city() -> 'economy' -> 'gossip' ->> 'taskClout')::int, reward)
 where kind = 'gossip' and done_at is null;

create or replace function public.rest(p_kind text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r jsonb := public.city() -> 'economy' -> 'rest' -> p_kind;
  today date := public.ny_today();
  me public.players;
  n int;
  v_energy int;
  v_mood int;
begin
  if r is null then raise exception 'bad_rest' using errcode = '22023'; end if;
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.at_place is not null then raise exception 'not_home' using errcode = '22023'; end if;
  if me.arrives_at > clock_timestamp() then raise exception 'still_travelling' using errcode = '22023'; end if;
  insert into public.player_rest (player_id, ny_date, kind, uses) values (uid, today, p_kind, 1)
  on conflict (player_id, ny_date, kind) do update set uses = public.player_rest.uses + 1
  returning uses into n;
  if n > (r ->> 'perDay')::int then raise exception 'rested_out' using errcode = '22023'; end if;
  v_energy := least(100 - me.energy, (r ->> 'energy')::int);
  v_mood := least(100 - me.mood, coalesce((r ->> 'mood')::int, 0));
  update public.players set energy = energy + v_energy, mood = mood + v_mood where id = uid;
  return jsonb_build_object('energy', v_energy, 'mood', v_mood, 'uses', n, 'left', (r ->> 'perDay')::int - n);
end;
$$;

create or replace function public.bar_drink(p_place text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d jsonb := public.city() -> 'economy' -> 'barDrink';
  place jsonb := (select p from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = p_place);
  me public.players;
  v_price int := (d ->> 'price')::int;
  v_energy int;
begin
  if place is null or not (place -> 'tags') ?| array(select jsonb_array_elements_text(d -> 'tags')) then
    raise exception 'unknown_action' using errcode = '22023';
  end if;
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.at_place is distinct from p_place then raise exception 'not_here' using errcode = '22023'; end if;
  if me.arrives_at > clock_timestamp() then raise exception 'still_travelling' using errcode = '22023'; end if;
  if me.energy >= 100 then raise exception 'full_energy' using errcode = '22023'; end if;
  if me.bank_cash < v_price then raise exception 'cant_afford' using errcode = '22023'; end if;
  v_energy := least(100 - me.energy, (d ->> 'energy')::int);
  update public.players set bank_cash = bank_cash - v_price, energy = energy + v_energy where id = uid;
  perform public.ledger_once(uid, 'cash', -v_price, 'drink', p_place || ':' || (extract(epoch from clock_timestamp()) * 1000)::bigint);
  return jsonb_build_object('cash', -v_price, 'energy', v_energy);
end;
$$;

create or replace function public.buy_groceries(p_place text, p_bundle text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g jsonb := public.city() -> 'economy' -> 'groceries';
  place jsonb := (select p from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = p_place);
  b jsonb := (select x from jsonb_array_elements(g -> 'bundles') x where x ->> 'id' = p_bundle);
  me public.players;
  v_price int;
  v_meals int;
begin
  if place is null or not (place -> 'tags') ?| array(select jsonb_array_elements_text(g -> 'tags')) then
    raise exception 'unknown_action' using errcode = '22023';
  end if;
  if b is null then raise exception 'unknown_bundle' using errcode = '22023'; end if;
  v_price := (b ->> 'price')::int;
  v_meals := (b ->> 'meals')::int;
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.at_place is distinct from p_place then raise exception 'not_here' using errcode = '22023'; end if;
  if me.arrives_at > clock_timestamp() then raise exception 'still_travelling' using errcode = '22023'; end if;
  if me.fridge_meals + v_meals > (g ->> 'fridgeMax')::int then raise exception 'fridge_full' using errcode = '22023'; end if;
  if me.bank_cash < v_price then raise exception 'cant_afford' using errcode = '22023'; end if;
  update public.players set bank_cash = bank_cash - v_price, fridge_meals = fridge_meals + v_meals where id = uid;
  perform public.ledger_once(uid, 'cash', -v_price, 'groceries', p_place || ':' || p_bundle || ':' || (extract(epoch from clock_timestamp()) * 1000)::bigint);
  return jsonb_build_object('cash', -v_price, 'meals', me.fridge_meals + v_meals);
end;
$$;

create or replace function public.cook()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c jsonb := public.city() -> 'economy' -> 'groceries' -> 'cook';
  me public.players;
  v_energy int;
begin
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if me.at_place is not null then raise exception 'not_home' using errcode = '22023'; end if;
  if me.arrives_at > clock_timestamp() then raise exception 'still_travelling' using errcode = '22023'; end if;
  if me.fridge_meals < 1 then raise exception 'fridge_empty' using errcode = '22023'; end if;
  if me.energy >= 100 then raise exception 'full_energy' using errcode = '22023'; end if;
  v_energy := least(100 - me.energy, (c ->> 'energy')::int);
  update public.players set fridge_meals = fridge_meals - 1, energy = energy + v_energy where id = uid;
  return jsonb_build_object('energy', v_energy, 'meals', me.fridge_meals - 1);
end;
$$;

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
  if me.arrives_at > clock_timestamp() then raise exception 'still_travelling' using errcode = '22023'; end if;
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
