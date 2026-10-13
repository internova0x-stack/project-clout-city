-- v0.10 step 3 (docs/08-new-features-spec.md section 8; owner Oct 13): neighborhood gossip, the weekly
-- content pipeline. A gossip week is one file (content/gossip/<Monday>.json): 3 to 5 stories of exactly
-- five pieces, each found at a place. Its stories stay findable for 14 days from their Monday.
--
-- Automatic (owner, Oct 13): week files go live on their own. The game server checks every file in
-- the repo (lib/gossip.ts, the Studio's rules) and stores it with gossip_import(), which only the
-- service role can call. A stored week is live from its Monday unless the owner pauses it or sends it
-- back with a note in the Studio, which holds it until the file changes. The Studio shows every week.
--
-- The file holds every piece, so players never read this table: step 4 (migration 0035) hands each
-- player only the pieces they've found. The progress tables are created here so the Studio can refuse
-- to change a week players have started.

-- The city seed gains the gossip numbers and each place's neighborhood, for gossip hints (scripts/gen-city-seed.ts).
update public.game_settings set value = '{"economy":{"shiftRate":120,"cloutPerDollar":0.6,"baseVisitClout":5,"cloutMultiplier":{"base":0.7,"mood":0.3,"confidence":0.3},"energy":{"dailyTopUp":20,"eventCost":20},"confidenceDriftPerDay":3,"dailyTasks":{"count":5,"rewardMin":40,"rewardMax":90,"bonus":150},"sellRate":0.6,"purchaseCloutDecay":0.85,"bills":{"every":"7 days","carRentalDays":7,"phone":25,"graceDays":2,"moodDropPerDay":8,"evictAfterDays":6,"carInsuranceRate":0.005},"gigs":{"side":{"confidence":0,"clout":0,"chance":0.9,"payMin":3,"payMax":5,"energy":1.5,"waitMinutes":60},"pro":{"confidence":50,"clout":500,"chance":0.5,"payMin":8,"payMax":10,"energy":2,"waitMinutes":120},"big":{"confidence":80,"clout":2000,"chance":0.22,"payMin":15,"payMax":20,"energy":3,"waitMinutes":240}},"shiftEnergy":25,"rest":{"nap":{"energy":30,"mood":0,"perDay":2,"seconds":8},"sit":{"energy":10,"mood":6,"perDay":3,"seconds":0}},"barDrink":{"price":28,"energy":20,"tags":["club","lounge"]},"groceries":{"fridgeMax":10,"cook":{"energy":25,"seconds":6},"tags":["supermarket"],"bundles":[{"id":"snack-run","emoji":"🥪","label":"Snack run","price":12,"meals":2,"blurb":"Chips, hummus, one sad apple. Technically two meals."},{"id":"meal-prep","emoji":"🥦","label":"Meal prep for the week","price":35,"meals":7,"blurb":"Seven containers, one Sunday, infinite smugness."}]},"travel":{"bandsMiles":[0.5,2,5],"walk":{"energy":[5,10,20,null],"seconds":[6,8,10,null]},"subway":{"fare":3,"seconds":[5,6,7,8]},"taxi":{"fare":[8,16,28,45],"seconds":[3,4,5,6]},"car":{"seconds":[3,4,5,6]}},"hunt":{"cash":1080,"clout":250,"retryMinutes":10,"badgeAfter":4},"gossip":{"pieces":5,"storiesPerWeek":{"min":3,"max":5},"liveDays":14,"clout":25,"mood":6,"badgeAfter":5},"lotto":{"tags":["lotto"],"freeGame":"corner-store","freePerDay":1,"beginner":{"days":7,"extraPerDay":1},"buyPerDay":5,"jackpot":{"seed":5000,"cut":0.1},"prizes":[{"times":1,"per100k":20000},{"times":2,"per100k":10000},{"times":5,"per100k":2500},{"times":20,"per100k":250},{"times":100,"per100k":20},{"times":1000,"per100k":1}],"bigFrom":100,"games":[{"id":"corner-store","name":"Corner Store Classic","price":5,"color":"#40B589","blurb":"The one your uncle buys with exact change."},{"id":"bodega-cat","name":"Bodega Cat Bonanza","price":10,"color":"#3E8EDE","blurb":"The cat picked the numbers. The cat has never been wrong."},{"id":"rents-due","name":"Rent''s Due","price":20,"color":"#FF2E88","blurb":"Financial planning, but make it shiny."},{"id":"penthouse-dreams","name":"Penthouse Dreams","price":50,"color":"#7A4FD6","blurb":"Scratch here to see the view. The view is the counter."},{"id":"main-character","name":"Main Character","price":100,"color":"#2A2530","blurb":"For people who are sure the plot is about them."}]}},"places":[{"id":"velvet-static","tags":["club","nightlife","first_party_venue"],"story":null,"at":[40.7465,-73.9455],"area":"Long Island City","actions":[{"id":"visit","kind":"visit","price":60,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"grind-and-gossip","tags":["cafe","dining_medium","job_barista"],"story":null,"at":[40.7645,-73.9225],"area":"Astoria","actions":[{"id":"eat","kind":"eat","price":18,"pay":0,"energy":-30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"shift","kind":"shift","price":0,"pay":120,"energy":25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"lucky-seven-deli","tags":["bodega","dining_budget"],"story":null,"at":[40.7495,-73.8885],"area":"Jackson Heights","actions":[{"id":"eat","kind":"eat","price":7,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"altitude-718","tags":["rooftop","dining_luxury"],"story":null,"at":[40.7425,-73.9555],"area":"Long Island City","actions":[{"id":"eat","kind":"eat","price":95,"pay":0,"energy":-55,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"flushing-meadows","tags":["park","outdoors"],"story":null,"at":[40.742,-73.844],"area":"Flushing Meadows","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pedal-pushers","tags":["delivery_hub","job_delivery"],"story":null,"at":[40.759,-73.928],"area":"Astoria","actions":[{"id":"shift","kind":"shift","price":0,"pay":135,"energy":30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skybridge-tower","tags":["office","gigs_board"],"story":null,"at":[40.7495,-73.9395],"area":"Long Island City","actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skyline-pier","tags":["skyline_pier","residential","waterfront"],"story":"sarah-bird","at":[40.7478,-73.9592],"area":"Long Island City","actions":[{"id":"lobby","kind":"visit","price":0,"pay":0,"energy":5,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"memorial","kind":"visit","price":0,"pay":0,"energy":2,"mood":4,"confidence":0,"clout":10,"storyUnlock":true}]},{"id":"hunters-pier","tags":["hunters_pier","waterfront","park"],"story":"sarah-bird","at":[40.7432,-73.9612],"area":"Long Island City","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rockaway-diner","tags":["rockaway_diner","diner","dining_budget"],"story":"sarah-bird","at":[40.7712,-73.9158],"area":"Astoria","actions":[{"id":"eat","kind":"eat","price":14,"pay":0,"energy":-25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"radiant-harbor","tags":["radiant_harbor","church"],"story":"sarah-bird","at":[40.7738,-73.9296],"area":"Astoria","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pressed-iron-gym","tags":["pressed_iron","gym"],"story":"sarah-bird","at":[40.7662,-73.9118],"area":"Astoria","actions":[{"id":"workout","kind":"visit","price":15,"pay":0,"energy":20,"mood":3,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"unisphere","tags":["monument","park"],"story":null,"at":[40.7466,-73.8448],"area":"Flushing Meadows","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":20,"storyUnlock":false},{"id":"tour","kind":"hangout","price":15,"pay":0,"energy":8,"mood":0,"confidence":5,"clout":null,"storyUnlock":false},{"id":"wish","kind":"hangout","price":1,"pay":0,"energy":0,"mood":4,"confidence":0,"clout":null,"storyUnlock":false},{"id":"pretzel","kind":"eat","price":5,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"people","kind":"hangout","price":0,"pay":0,"energy":3,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"gantry-plaza","tags":["monument","waterfront"],"story":null,"at":[40.7454,-73.9584],"area":"Long Island City","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":20,"storyUnlock":false},{"id":"photoshoot","kind":"hangout","price":0,"pay":0,"energy":10,"mood":0,"confidence":6,"clout":null,"storyUnlock":false},{"id":"picnic","kind":"eat","price":12,"pay":0,"energy":-20,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"ferries","kind":"hangout","price":0,"pay":0,"energy":2,"mood":7,"confidence":0,"clout":null,"storyUnlock":false},{"id":"run","kind":"hangout","price":0,"pay":0,"energy":15,"mood":4,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"low-light-lounge","tags":["lounge","nightlife","exclusive_venue"],"story":null,"at":[40.7612,-73.9175],"area":"Astoria","actions":[{"id":"visit","kind":"visit","price":45,"pay":0,"energy":10,"mood":8,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"thread-count","tags":["boutique","shopping","fashion"],"story":null,"at":[40.7651,-73.9204],"area":"Astoria","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"boulevard-motors","tags":["dealership","shopping","cars"],"story":null,"at":[40.7503,-73.9372],"area":"Long Island City","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"st-johnsons","tags":["university","campus"],"story":null,"at":[40.7224,-73.7949],"area":"Jamaica","actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false}]},{"id":"queensborough-u","tags":["university","campus"],"story":null,"at":[40.7366,-73.817],"area":"Flushing","actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false}]},{"id":"ditmars-deli","tags":["bodega","dining_budget","astoria"],"story":null,"at":[40.7748,-73.9128],"area":"Astoria","actions":[{"id":"eat","kind":"eat","price":6,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"two-bros-pizza","tags":["pizza","dining_budget","astoria"],"story":null,"at":[40.7668,-73.9208],"area":"Astoria","actions":[{"id":"eat","kind":"eat","price":4,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"neon-spoon","tags":["diner","dining_medium","astoria"],"story":null,"at":[40.7695,-73.9265],"area":"Astoria","actions":[{"id":"eat","kind":"eat","price":16,"pay":0,"energy":-28,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"up-on-thirty","tags":["rooftop","dining_luxury","astoria"],"story":null,"at":[40.7672,-73.9238],"area":"Astoria","actions":[{"id":"eat","kind":"eat","price":70,"pay":0,"energy":-50,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"steinway-fresh","tags":["supermarket","astoria"],"story":null,"at":[40.7628,-73.916],"area":"Astoria","actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"hellgate-hall","tags":["club","nightlife","astoria"],"story":null,"at":[40.7737,-73.9178],"area":"Astoria","actions":[{"id":"visit","kind":"visit","price":50,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"triborough-works","tags":["office","coworking","gigs_board","astoria"],"story":null,"at":[40.766,-73.9252],"area":"Astoria","actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"ditmars-library","tags":["library","free","astoria"],"story":null,"at":[40.7735,-73.9098],"area":"Astoria","actions":[{"id":"study","kind":"visit","price":0,"pay":0,"energy":10,"mood":0,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"precinct-114-half","tags":["police","free","astoria"],"story":null,"at":[40.769,-73.9228],"area":"Astoria","actions":[{"id":"report","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"engine-7","tags":["firehouse","free","astoria"],"story":null,"at":[40.772,-73.9205],"area":"Astoria","actions":[{"id":"pet-dog","kind":"visit","price":0,"pay":0,"energy":2,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"astoria-cc","tags":["college","campus","astoria"],"story":null,"at":[40.76,-73.9232],"area":"Astoria","actions":[{"id":"night-class","kind":"visit","price":20,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":10,"storyUnlock":false}]},{"id":"harmony-chapel","tags":["chapel","quiet","free","astoria"],"story":null,"at":[40.7652,-73.913],"area":"Astoria","actions":[{"id":"quiet","kind":"visit","price":0,"pay":0,"energy":2,"mood":7,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"hell-gate-park","tags":["park","outdoors","free","astoria"],"story":null,"at":[40.779,-73.9232],"area":"Astoria","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rep-count","tags":["gym","astoria"],"story":null,"at":[40.764,-73.9146],"area":"Astoria","actions":[{"id":"workout","kind":"visit","price":12,"pay":0,"energy":20,"mood":2,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"astoria-blvd-station","tags":["subway","transit","free","astoria"],"story":null,"at":[40.7702,-73.918],"area":"Astoria","actions":[{"id":"platform","kind":"visit","price":0,"pay":0,"energy":2,"mood":2,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"reel-queens","tags":["cinema","date_spot","astoria"],"story":null,"at":[40.7605,-73.9196],"area":"Astoria","actions":[{"id":"movie","kind":"eat","price":15,"pay":0,"energy":-10,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"respawn-arena","tags":["games","arena","astoria"],"story":null,"at":[40.7708,-73.9105],"area":"Astoria","actions":[{"id":"match","kind":"visit","price":10,"pay":0,"energy":15,"mood":0,"confidence":5,"clout":12,"storyUnlock":false}]},{"id":"lucky-star","tags":["lotto","flushing"],"story":null,"at":[40.7593,-73.8301],"area":"Flushing","actions":[{"id":"chat","kind":"visit","price":0,"pay":0,"energy":2,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]}],"events":[{"id":"neon-nights","placeId":"velvet-static","startHour":22,"hours":5,"entry":80,"clout":60,"confidence":8,"mood":6},{"id":"bass-bath","placeId":"hellgate-hall","startHour":21,"hours":5,"entry":70,"clout":50,"confidence":7,"mood":7},{"id":"golden-hour","placeId":"velvet-static","startHour":15,"hours":4,"entry":50,"clout":40,"confidence":6,"mood":8},{"id":"homecoming-tailgate","placeId":"st-johnsons","startHour":16,"hours":4,"entry":15,"clout":35,"confidence":4,"mood":10},{"id":"quad-open-mic","placeId":"queensborough-u","startHour":19,"hours":3,"entry":10,"clout":30,"confidence":8,"mood":6}],"gigs":{"side":["Be a professional crowd at a gallery opening","Stand in line for a sneaker drop","Laugh on cue at a comedy open mic","Hold a ring light at a rooftop shoot"],"pro":["Run a launch campaign for a $14 artisanal ice cube startup","Ghost-write a podcast host''s \"authentic\" origin story","Manage socials for a dog with 40k followers"],"big":["Write a speech for a councilmember candidate","Art-direct a perfume ad for a fictional heiress"]},"shop":[{"sku":"fit-satin-bomber","category":"fashion","price":180,"clout":25,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false},{"sku":"fit-leather-blazer","category":"fashion","price":420,"clout":45,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false},{"sku":"fit-varsity-tee","category":"fashion","price":65,"clout":10,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false},{"sku":"fit-wide-trousers","category":"fashion","price":140,"clout":18,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false},{"sku":"fit-mini-skirt","category":"fashion","price":120,"clout":16,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false},{"sku":"fit-chunky-sneakers","category":"fashion","price":210,"clout":28,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":false},{"sku":"forever-our-bird-hoodie","category":"fashion","price":85,"clout":12,"rentPerWeek":0,"slot":"top","storyOnly":true,"collector":false},{"sku":"col-faux-chinchilla","category":"fashion","price":0,"clout":80,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":true},{"sku":"col-holo-boots","category":"fashion","price":0,"clout":70,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":true},{"sku":"fit-bucket-hat","category":"fashion","price":55,"clout":8,"rentPerWeek":0,"slot":"accessory","storyOnly":false,"collector":false},{"sku":"car-hatchback","category":"cars","price":14000,"clout":120,"rentPerWeek":350,"slot":null,"storyOnly":false,"collector":false},{"sku":"car-luxury-sedan","category":"cars","price":52000,"clout":300,"rentPerWeek":900,"slot":null,"storyOnly":false,"collector":false},{"sku":"car-electric-coupe","category":"cars","price":78000,"clout":420,"rentPerWeek":1300,"slot":null,"storyOnly":false,"collector":false},{"sku":"house-astoria-townhouse","category":"houses","price":180000,"clout":900,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"house-lic-penthouse","category":"houses","price":650000,"clout":2400,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"lux-gold-chain","category":"luxury","price":900,"clout":70,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"lux-diamond-studs","category":"luxury","price":2400,"clout":140,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"lux-designer-watch","category":"luxury","price":6800,"clout":260,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"mu-glow-kit","category":"makeup","price":75,"clout":12,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"mu-lip-set","category":"makeup","price":95,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"mu-lash-bar","category":"makeup","price":160,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false}],"homeLocations":{"astoria_studio":[40.7745,-73.905],"jackson_heights_1br":[40.752,-73.883],"lic_highrise":[40.747,-73.956]}}'::jsonb, updated_at = now() where key = 'city';

create table public.gossip_weeks (
  week        date primary key check (extract(isodow from week) = 1),
  data        jsonb not null,
  -- approved: live from its Monday (the default). review: held, sent back with a note. paused: hidden.
  status      text not null default 'approved' check (status in ('review', 'approved', 'paused')),
  review_note text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- A piece a player found: by listening in, from a regular, or shared by their crew.
create table public.gossip_found (
  player_id uuid not null references public.players (id) on delete cascade,
  story_id  text not null,
  piece     int not null check (piece between 0 and 9),
  via       text not null check (via in ('overheard', 'regular', 'crew')),
  found_at  timestamptz not null default now(),
  primary key (player_id, story_id, piece)
);

-- A finished story's Tea card: a copy as it was earned, so later edits never change a player's card.
create table public.gossip_cards (
  player_id uuid not null references public.players (id) on delete cascade,
  story_id  text not null,
  week      date not null,
  title     text not null,
  emoji     text not null,
  topic     text not null,
  headline  text not null,
  body      text not null,
  earned_at timestamptz not null default now(),
  primary key (player_id, story_id)
);

-- A piece shared with the crew: once per piece.
create table public.gossip_shares (
  player_id uuid not null references public.players (id) on delete cascade,
  story_id  text not null,
  piece     int not null,
  shared_at timestamptz not null default now(),
  primary key (player_id, story_id, piece)
);

alter table public.gossip_weeks enable row level security;
alter table public.gossip_found enable row level security;
alter table public.gossip_cards enable row level security;
alter table public.gossip_shares enable row level security;
revoke all on public.gossip_weeks, public.gossip_found, public.gossip_cards, public.gossip_shares from anon, authenticated;

/** Every gossip week, newest first, with how many players have started and finished each story. */
create function public.admin_gossip_list() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'week', g.week, 'status', g.status, 'data', g.data, 'note', g.review_note,
      'started', (select coalesce(jsonb_object_agg(s ->> 'id', (select count(distinct f.player_id) from public.gossip_found f where f.story_id = s ->> 'id')), '{}'::jsonb)
                    from jsonb_array_elements(g.data -> 'stories') s),
      'finished', (select coalesce(jsonb_object_agg(s ->> 'id', (select count(*) from public.gossip_cards c where c.story_id = s ->> 'id')), '{}'::jsonb)
                    from jsonb_array_elements(g.data -> 'stories') s)
    ) order by g.week desc) from public.gossip_weeks g), '[]'::jsonb);
end;
$$;

/**
 * Stores a week (already checked by the app). New weeks go live on their Monday. A changed file
 * replaces the old one and goes live again (a held week's fix), unless the week is paused. Once
 * players have found a piece of that week its stories can't change: the old text stays, and the
 * answer is 'in_play'. Returns 'new', 'changed', 'same' or 'in_play'.
 */
create function public.gossip_store(p_data jsonb) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_week date := (p_data ->> 'week')::date;
  old public.gossip_weeks;
begin
  if jsonb_typeof(p_data -> 'stories') is distinct from 'array' then raise exception 'bad_gossip' using errcode = '22023'; end if;
  -- A story id belongs to one week: players' progress is keyed by it.
  if exists (select 1 from public.gossip_weeks w, jsonb_array_elements(w.data -> 'stories') s, jsonb_array_elements(p_data -> 'stories') n
              where w.week <> v_week and s ->> 'id' = n ->> 'id') then
    raise exception 'gossip_id_taken' using errcode = '22023';
  end if;
  select * into old from public.gossip_weeks where week = v_week;
  if old.week is null then
    insert into public.gossip_weeks (week, data) values (v_week, p_data);
    return 'new';
  end if;
  if old.data = p_data then return 'same'; end if;
  if exists (select 1 from public.gossip_found f, jsonb_array_elements(old.data -> 'stories') s where f.story_id = s ->> 'id') then
    return 'in_play';
  end if;
  update public.gossip_weeks
     set data = p_data, updated_at = now(), review_note = null,
         status = case when status = 'paused' then 'paused' else 'approved' end
   where week = v_week;
  return 'changed';
end;
$$;
revoke all on function public.gossip_store(jsonb) from public, anon, authenticated;

/** The game server's import of a checked week file (service role only). */
create function public.gossip_import(p_data jsonb) returns text
language sql security definer set search_path = public
as $$ select public.gossip_store(p_data) $$;
revoke all on function public.gossip_import(jsonb) from public, anon, authenticated;
grant execute on function public.gossip_import(jsonb) to service_role;

/** The Studio's manual upload (admins): same rules; a week players are in can't be edited. */
create function public.admin_gossip_upsert(p_data jsonb) returns text
language plpgsql security definer set search_path = public
as $$
declare r text;
begin
  perform public.require_story_admin();
  r := public.gossip_store(p_data);
  if r = 'in_play' then raise exception 'gossip_in_play' using errcode = '22023'; end if;
  return r;
end;
$$;

/** Let it run (approved), pause (hides its stories at once; found pieces and Tea cards are kept) or hold it with a note. */
create function public.admin_gossip_status(p_week date, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  if p_status not in ('review', 'approved', 'paused') then raise exception 'bad_status' using errcode = '22023'; end if;
  update public.gossip_weeks
     set status = p_status, updated_at = now(),
         review_note = case when p_status = 'review' then nullif(btrim(p_note), '') when p_status = 'approved' then null else review_note end
   where week = p_week;
  if not found then raise exception 'unknown_gossip' using errcode = '22023'; end if;
end;
$$;

revoke all on function public.admin_gossip_list() from public, anon;
grant execute on function public.admin_gossip_list() to authenticated;
revoke all on function public.admin_gossip_upsert(jsonb) from public, anon;
grant execute on function public.admin_gossip_upsert(jsonb) to authenticated;
revoke all on function public.admin_gossip_status(date, text, text) from public, anon;
grant execute on function public.admin_gossip_status(date, text, text) to authenticated;
