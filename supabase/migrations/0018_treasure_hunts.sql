-- v0.6 "Astoria and the News", step 4: weekly treasure hunts (docs/08-new-features-spec.md section 1).
--
-- A hunt is one week file (content/hunts/<Monday>.json): a theme, 4 or 5 places in order and one
-- track per starting style. The app checks the file (lib/hunts.ts) before the Studio uploads it;
-- it waits in review until approved and runs Monday to Sunday, New York time. The file carries
-- the answers, so players never read the table: hunt_state() sends what they've earned.
--
-- A player joins once; their starting style picks the track. At each step they visit the place
-- (any action there, at the normal cost) and talk to its regular, whose line is the clue. Some
-- steps ask a question: a wrong answer waits 10 minutes. The finale's right answer pays cash and
-- clout once (ledger), keeps a hunt card, and four hunts earn the Treasure Hunter badge.
-- Clues are always free; nothing here can be bought.

-- The economy gains its hunt numbers (generated from lib/city.ts by scripts/gen-city-seed.ts).
update public.game_settings set value = '{"economy":{"shiftRate":120,"cloutPerDollar":0.6,"baseVisitClout":5,"cloutMultiplier":{"base":0.7,"mood":0.3,"confidence":0.3},"energy":{"dailyTopUp":20,"eventCost":20},"confidenceDriftPerDay":3,"dailyTasks":{"count":5,"rewardMin":40,"rewardMax":90,"bonus":150},"sellRate":0.6,"purchaseCloutDecay":0.85,"bills":{"every":"1 month","carRentalDays":7,"phone":85,"graceDays":3,"moodDropPerDay":8,"evictAfterDays":7,"carInsuranceRate":0.02},"gigs":{"side":{"confidence":0,"chance":0.9,"payMin":3,"payMax":5,"energy":1.5,"waitMinutes":60},"pro":{"confidence":50,"chance":0.5,"payMin":8,"payMax":10,"energy":2,"waitMinutes":120},"big":{"confidence":80,"chance":0.22,"payMin":15,"payMax":20,"energy":3,"waitMinutes":240}},"shiftEnergy":25,"hunt":{"cash":1080,"clout":250,"retryMinutes":10,"badgeAfter":4}},"places":[{"id":"velvet-static","tags":["club","nightlife","first_party_venue"],"story":null,"actions":[{"id":"visit","kind":"visit","price":60,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"grind-and-gossip","tags":["cafe","dining_medium","job_barista"],"story":null,"actions":[{"id":"eat","kind":"eat","price":18,"pay":0,"energy":-30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"shift","kind":"shift","price":0,"pay":120,"energy":25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"lucky-seven-deli","tags":["bodega","dining_budget"],"story":null,"actions":[{"id":"eat","kind":"eat","price":7,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"altitude-718","tags":["rooftop","dining_luxury"],"story":null,"actions":[{"id":"eat","kind":"eat","price":95,"pay":0,"energy":-55,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"flushing-meadows","tags":["park","outdoors"],"story":null,"actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pedal-pushers","tags":["delivery_hub","job_delivery"],"story":null,"actions":[{"id":"shift","kind":"shift","price":0,"pay":135,"energy":30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skybridge-tower","tags":["office","gigs_board"],"story":null,"actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skyline-pier","tags":["skyline_pier","residential","waterfront"],"story":"sarah-bird","actions":[{"id":"lobby","kind":"visit","price":0,"pay":0,"energy":5,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"memorial","kind":"visit","price":0,"pay":0,"energy":2,"mood":4,"confidence":0,"clout":10,"storyUnlock":true}]},{"id":"hunters-pier","tags":["hunters_pier","waterfront","park"],"story":"sarah-bird","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rockaway-diner","tags":["rockaway_diner","diner","dining_budget"],"story":"sarah-bird","actions":[{"id":"eat","kind":"eat","price":14,"pay":0,"energy":-25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"radiant-harbor","tags":["radiant_harbor","church"],"story":"sarah-bird","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pressed-iron-gym","tags":["pressed_iron","gym"],"story":"sarah-bird","actions":[{"id":"workout","kind":"visit","price":15,"pay":0,"energy":20,"mood":3,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"unisphere","tags":["monument","park"],"story":null,"actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":20,"storyUnlock":false}]},{"id":"gantry-plaza","tags":["monument","waterfront"],"story":null,"actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":20,"storyUnlock":false}]},{"id":"low-light-lounge","tags":["lounge","nightlife","exclusive_venue"],"story":null,"actions":[{"id":"visit","kind":"visit","price":45,"pay":0,"energy":10,"mood":8,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"thread-count","tags":["boutique","shopping","fashion"],"story":null,"actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"boulevard-motors","tags":["dealership","shopping","cars"],"story":null,"actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":3,"clout":null,"storyUnlock":false}]},{"id":"st-johnsons","tags":["university","campus"],"story":null,"actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false}]},{"id":"queensborough-u","tags":["university","campus"],"story":null,"actions":[{"id":"lecture","kind":"visit","price":0,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":15,"storyUnlock":false}]},{"id":"ditmars-deli","tags":["bodega","dining_budget","astoria"],"story":null,"actions":[{"id":"eat","kind":"eat","price":6,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"two-bros-pizza","tags":["pizza","dining_budget","astoria"],"story":null,"actions":[{"id":"eat","kind":"eat","price":4,"pay":0,"energy":-12,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"neon-spoon","tags":["diner","dining_medium","astoria"],"story":null,"actions":[{"id":"eat","kind":"eat","price":16,"pay":0,"energy":-28,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"up-on-thirty","tags":["rooftop","dining_luxury","astoria"],"story":null,"actions":[{"id":"eat","kind":"eat","price":70,"pay":0,"energy":-50,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"steinway-fresh","tags":["supermarket","astoria"],"story":null,"actions":[{"id":"browse","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"hellgate-hall","tags":["club","nightlife","astoria"],"story":null,"actions":[{"id":"visit","kind":"visit","price":50,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"triborough-works","tags":["office","coworking","gigs_board","astoria"],"story":null,"actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"ditmars-library","tags":["library","free","astoria"],"story":null,"actions":[{"id":"study","kind":"visit","price":0,"pay":0,"energy":10,"mood":0,"confidence":5,"clout":null,"storyUnlock":false}]},{"id":"precinct-114-half","tags":["police","free","astoria"],"story":null,"actions":[{"id":"report","kind":"visit","price":0,"pay":0,"energy":3,"mood":3,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"engine-7","tags":["firehouse","free","astoria"],"story":null,"actions":[{"id":"pet-dog","kind":"visit","price":0,"pay":0,"energy":2,"mood":6,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"astoria-cc","tags":["college","campus","astoria"],"story":null,"actions":[{"id":"night-class","kind":"visit","price":20,"pay":0,"energy":15,"mood":0,"confidence":6,"clout":10,"storyUnlock":false}]},{"id":"harmony-chapel","tags":["chapel","quiet","free","astoria"],"story":null,"actions":[{"id":"quiet","kind":"visit","price":0,"pay":0,"energy":2,"mood":7,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"hell-gate-park","tags":["park","outdoors","free","astoria"],"story":null,"actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rep-count","tags":["gym","astoria"],"story":null,"actions":[{"id":"workout","kind":"visit","price":12,"pay":0,"energy":20,"mood":2,"confidence":6,"clout":null,"storyUnlock":false}]},{"id":"astoria-blvd-station","tags":["subway","transit","free","astoria"],"story":null,"actions":[{"id":"platform","kind":"visit","price":0,"pay":0,"energy":2,"mood":2,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"reel-queens","tags":["cinema","date_spot","astoria"],"story":null,"actions":[{"id":"movie","kind":"eat","price":15,"pay":0,"energy":-10,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"respawn-arena","tags":["games","arena","astoria"],"story":null,"actions":[{"id":"match","kind":"visit","price":10,"pay":0,"energy":15,"mood":0,"confidence":5,"clout":12,"storyUnlock":false}]}],"events":[{"id":"neon-nights","placeId":"velvet-static","startHour":22,"hours":5,"entry":80,"clout":60,"confidence":8,"mood":6},{"id":"bass-bath","placeId":"hellgate-hall","startHour":21,"hours":5,"entry":70,"clout":50,"confidence":7,"mood":7},{"id":"golden-hour","placeId":"velvet-static","startHour":15,"hours":4,"entry":50,"clout":40,"confidence":6,"mood":8},{"id":"homecoming-tailgate","placeId":"st-johnsons","startHour":16,"hours":4,"entry":15,"clout":35,"confidence":4,"mood":10},{"id":"quad-open-mic","placeId":"queensborough-u","startHour":19,"hours":3,"entry":10,"clout":30,"confidence":8,"mood":6}],"gigs":{"side":["Be a professional crowd at a gallery opening","Stand in line for a sneaker drop","Laugh on cue at a comedy open mic","Hold a ring light at a rooftop shoot"],"pro":["Run a launch campaign for a $14 artisanal ice cube startup","Ghost-write a podcast host''s \"authentic\" origin story","Manage socials for a dog with 40k followers"],"big":["Write a speech for a councilmember candidate","Art-direct a perfume ad for a fictional heiress"]},"shop":[{"sku":"fit-satin-bomber","category":"fashion","price":180,"clout":25,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false},{"sku":"fit-leather-blazer","category":"fashion","price":420,"clout":45,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false},{"sku":"fit-varsity-tee","category":"fashion","price":65,"clout":10,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":false},{"sku":"fit-wide-trousers","category":"fashion","price":140,"clout":18,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false},{"sku":"fit-mini-skirt","category":"fashion","price":120,"clout":16,"rentPerWeek":0,"slot":"bottom","storyOnly":false,"collector":false},{"sku":"fit-chunky-sneakers","category":"fashion","price":210,"clout":28,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":false},{"sku":"forever-our-bird-hoodie","category":"fashion","price":85,"clout":12,"rentPerWeek":0,"slot":"top","storyOnly":true,"collector":false},{"sku":"col-faux-chinchilla","category":"fashion","price":0,"clout":80,"rentPerWeek":0,"slot":"top","storyOnly":false,"collector":true},{"sku":"col-holo-boots","category":"fashion","price":0,"clout":70,"rentPerWeek":0,"slot":"shoes","storyOnly":false,"collector":true},{"sku":"fit-bucket-hat","category":"fashion","price":55,"clout":8,"rentPerWeek":0,"slot":"accessory","storyOnly":false,"collector":false},{"sku":"car-hatchback","category":"cars","price":14000,"clout":120,"rentPerWeek":350,"slot":null,"storyOnly":false,"collector":false},{"sku":"car-luxury-sedan","category":"cars","price":52000,"clout":300,"rentPerWeek":900,"slot":null,"storyOnly":false,"collector":false},{"sku":"car-electric-coupe","category":"cars","price":78000,"clout":420,"rentPerWeek":1300,"slot":null,"storyOnly":false,"collector":false},{"sku":"house-astoria-townhouse","category":"houses","price":180000,"clout":900,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"house-lic-penthouse","category":"houses","price":650000,"clout":2400,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"lux-gold-chain","category":"luxury","price":900,"clout":70,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"lux-diamond-studs","category":"luxury","price":2400,"clout":140,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"lux-designer-watch","category":"luxury","price":6800,"clout":260,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"mu-glow-kit","category":"makeup","price":75,"clout":12,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"mu-lip-set","category":"makeup","price":95,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false},{"sku":"mu-lash-bar","category":"makeup","price":160,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false,"collector":false}],"homeLocations":{"astoria_studio":[40.7745,-73.905],"jackson_heights_1br":[40.752,-73.883],"lic_highrise":[40.747,-73.956]}}'::jsonb, updated_at = now() where key = 'city';

create table public.hunts (
  id          text primary key check (id ~ '^[a-z0-9-]{3,40}$'),
  week        date not null unique check (extract(isodow from week) = 1),
  data        jsonb not null,
  status      text not null default 'review' check (status in ('review', 'approved', 'paused')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.hunt_progress (
  player_id    uuid not null references public.players (id) on delete cascade,
  hunt_id      text not null references public.hunts (id),
  style        text not null,
  step         int not null default 0,
  talked       boolean not null default false,
  wrong_at     timestamptz,
  joined_at    timestamptz not null default now(),
  completed_at timestamptz,
  primary key (player_id, hunt_id)
);

-- A copy of the card as it was earned, so later edits to a hunt never change a player's card.
create table public.hunt_cards (
  player_id uuid not null references public.players (id) on delete cascade,
  hunt_id   text not null,
  week      date not null,
  theme     text not null,
  treasure  text not null,
  emoji     text not null,
  lore      text not null,
  earned_at timestamptz not null default now(),
  primary key (player_id, hunt_id)
);

alter table public.hunts enable row level security;
alter table public.hunt_progress enable row level security;
alter table public.hunt_cards enable row level security;
revoke all on public.hunts, public.hunt_progress, public.hunt_cards from anon, authenticated;

/** This week's approved hunt, if any (Monday to Sunday, New York). */
create function public.hunt_current() returns public.hunts
language sql stable security definer set search_path = public
as $$
  select * from public.hunts
   where status = 'approved' and public.ny_today() between week and week + 6
   limit 1
$$;

/** What one player sees of a hunt (mirrors huntView in lib/hunts.ts). Never an answer. */
create function public.hunt_view(p_hunt public.hunts, p_player uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  pr public.hunt_progress;
  t jsonb;
  s jsonb;
  cur jsonb;
  heard jsonb := '[]';
  retry timestamptz;
  base jsonb := jsonb_build_object(
    'id', p_hunt.id, 'week', p_hunt.week, 'theme', p_hunt.data ->> 'theme', 'intro', p_hunt.data ->> 'intro',
    'endsOn', p_hunt.week + 6, 'firstPlace', p_hunt.data -> 'places' ->> 0);
begin
  select * into pr from public.hunt_progress where player_id = p_player and hunt_id = p_hunt.id;
  if pr.player_id is null then
    return base || jsonb_build_object('joined', false, 'track', null, 'step', 0, 'heard', '[]'::jsonb,
      'question', null, 'completedAt', null, 'chatter', '[]'::jsonb);
  end if;
  t := p_hunt.data -> 'tracks' -> pr.style;
  for i in 0 .. jsonb_array_length(t -> 'steps') - 1 loop
    s := t -> 'steps' -> i;
    if i < pr.step then
      heard := heard || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('placeId', p_hunt.data -> 'places' ->> i, 'say', s ->> 'say', 'then', s ->> 'then')));
    elsif i = pr.step and pr.talked then
      heard := heard || jsonb_build_array(jsonb_build_object('placeId', p_hunt.data -> 'places' ->> i, 'say', s ->> 'say'));
    end if;
  end loop;
  cur := t -> 'steps' -> pr.step;
  retry := pr.wrong_at + make_interval(mins => (public.city() -> 'economy' -> 'hunt' ->> 'retryMinutes')::int);
  return base || jsonb_build_object(
    'joined', true,
    'track', jsonb_build_object('style', pr.style, 'treasure', t ->> 'treasure', 'emoji', t ->> 'emoji', 'lore', t ->> 'lore',
      'steps', jsonb_array_length(t -> 'steps')),
    'step', pr.step,
    'heard', heard,
    'question', case when pr.talked and cur ? 'question' then jsonb_build_object(
      'q', cur -> 'question' ->> 'q', 'choices', cur -> 'question' -> 'choices',
      'retryAt', case when retry > public.game_now() then retry end) end,
    'completedAt', pr.completed_at,
    'chatter', coalesce((select jsonb_agg(replace(c, '{treasure}', t ->> 'treasure'))
                           from jsonb_array_elements_text(p_hunt.data -> 'chatter') c), '[]'::jsonb));
end;
$$;

/** The signed-in player's hunt: this week's (if approved), their hunt cards and how many they've done. */
create function public.hunt_state() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  h public.hunts := public.hunt_current();
begin
  return jsonb_build_object(
    'hunt', case when h.id is not null then public.hunt_view(h, uid) end,
    'cards', coalesce((select jsonb_agg(jsonb_build_object('huntId', hunt_id, 'week', week, 'theme', theme, 'treasure', treasure,
                         'emoji', emoji, 'lore', lore, 'earnedAt', earned_at) order by earned_at desc, week desc)
                         from public.hunt_cards where player_id = uid), '[]'::jsonb),
    'completed', (select count(*) from public.hunt_cards where player_id = uid));
end;
$$;

/** One tap joins this week's hunt on the player's starting-style track. */
create function public.hunt_join() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  h public.hunts := public.hunt_current();
  v_style text := (select starting_style from public.players where id = uid);
begin
  if v_style is null then raise exception 'no_player' using errcode = '28000'; end if;
  if h.id is null then raise exception 'no_hunt' using errcode = '22023'; end if;
  insert into public.hunt_progress (player_id, hunt_id, style) values (uid, h.id, v_style) on conflict do nothing;
  return public.hunt_state();
end;
$$;

/**
 * Talking to the regular at a place. Raises not_here when they have nothing for the hunt (the
 * app then shows their everyday line) and visit_first when the player hasn't been there today.
 */
create function public.hunt_talk(p_place text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  h public.hunts := public.hunt_current();
  pr public.hunt_progress;
  s jsonb;
begin
  if h.id is null then raise exception 'not_here' using errcode = '22023'; end if;
  select * into pr from public.hunt_progress where player_id = uid and hunt_id = h.id for update;
  if pr.player_id is null or pr.completed_at is not null or h.data -> 'places' ->> pr.step is distinct from p_place then
    raise exception 'not_here' using errcode = '22023';
  end if;
  if not exists (select 1 from public.place_visits where player_id = uid and place_id = p_place and ny_date = public.ny_today()) then
    raise exception 'visit_first' using errcode = '22023';
  end if;
  s := h.data -> 'tracks' -> pr.style -> 'steps' -> pr.step;
  if s ? 'question' then
    update public.hunt_progress set talked = true where player_id = uid and hunt_id = h.id;
  else
    update public.hunt_progress set step = step + 1, talked = false, wrong_at = null where player_id = uid and hunt_id = h.id;
  end if;
  return jsonb_build_object(
    'line', jsonb_build_object('say', s ->> 'say', 'question',
      case when s ? 'question' then jsonb_build_object('q', s -> 'question' ->> 'q', 'choices', s -> 'question' -> 'choices') end),
    'state', public.hunt_state());
end;
$$;

/** Answering the open question. The finale's right answer pays once and keeps the hunt card. */
create function public.hunt_answer(p_choice int) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  h public.hunts := public.hunt_current();
  e jsonb := public.city() -> 'economy' -> 'hunt';
  pr public.hunt_progress;
  t jsonb;
  s jsonb;
  v_finished boolean;
  v_cash int := 0;
  v_clout int := 0;
  v_badge boolean := false;
begin
  if h.id is null then raise exception 'not_here' using errcode = '22023'; end if;
  select * into pr from public.hunt_progress where player_id = uid and hunt_id = h.id for update;
  t := h.data -> 'tracks' -> pr.style;
  s := t -> 'steps' -> pr.step;
  if pr.player_id is null or pr.completed_at is not null or not pr.talked or not coalesce(s ? 'question', false) then
    raise exception 'not_here' using errcode = '22023';
  end if;
  if pr.wrong_at + make_interval(mins => (e ->> 'retryMinutes')::int) > public.game_now() then
    raise exception 'wait' using errcode = '22023';
  end if;
  if p_choice is distinct from (s -> 'question' ->> 'answer')::int then
    update public.hunt_progress set wrong_at = public.game_now() where player_id = uid and hunt_id = h.id;
    return jsonb_build_object('correct', false, 'state', public.hunt_state());
  end if;

  v_finished := pr.step + 1 >= jsonb_array_length(h.data -> 'places');
  update public.hunt_progress
     set step = step + 1, talked = false, wrong_at = null,
         completed_at = case when v_finished then public.game_now() end
   where player_id = uid and hunt_id = h.id;
  if v_finished then
    insert into public.hunt_cards (player_id, hunt_id, week, theme, treasure, emoji, lore)
    values (uid, h.id, h.week, h.data ->> 'theme', t ->> 'treasure', t ->> 'emoji', t ->> 'lore')
    on conflict do nothing;
    if public.ledger_once(uid, 'cash', (e ->> 'cash')::int, 'hunt', h.id) then v_cash := (e ->> 'cash')::int; end if;
    if public.ledger_once(uid, 'clout', (e ->> 'clout')::int, 'hunt', h.id) then v_clout := (e ->> 'clout')::int; end if;
    update public.players set bank_cash = bank_cash + v_cash, clout = clout + v_clout where id = uid;
    if (select count(*) from public.hunt_cards where player_id = uid) >= (e ->> 'badgeAfter')::int then
      insert into public.player_badges (player_id, badge_id, arc_id) values (uid, 'treasure-hunter', h.id) on conflict do nothing;
      v_badge := found;
    end if;
  end if;
  return jsonb_build_object(
    'correct', true, 'then', s ->> 'then',
    'reward', case when v_finished then jsonb_build_object('cash', v_cash, 'clout', v_clout, 'badge', v_badge) end,
    'state', public.hunt_state());
end;
$$;

-- ---------------------------------------------------------------------------
-- Story Studio
-- ---------------------------------------------------------------------------

/** Every hunt, newest week first, with joins, finishes and where players are stuck. */
create function public.admin_hunt_list() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', h.id, 'week', h.week, 'status', h.status, 'data', h.data,
      'joined', (select count(*) from public.hunt_progress p where p.hunt_id = h.id),
      'completed', (select count(*) from public.hunt_progress p where p.hunt_id = h.id and p.completed_at is not null),
      'atStep', (select coalesce(jsonb_agg(n order by i), '[]'::jsonb) from (
                   select i, (select count(*) from public.hunt_progress p where p.hunt_id = h.id and p.completed_at is null and p.step = i) n
                     from generate_series(0, jsonb_array_length(h.data -> 'places') - 1) i) x)
    ) order by h.week desc) from public.hunts h), '[]'::jsonb);
end;
$$;

/**
 * Adds or replaces a week's hunt (already checked by the app). A changed hunt goes back to
 * review; an approved one re-uploaded unchanged stays approved.
 */
create function public.admin_hunt_upsert(p_data jsonb) returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  if jsonb_typeof(p_data -> 'tracks') is distinct from 'object' then raise exception 'bad_hunt' using errcode = '22023'; end if;
  insert into public.hunts (id, week, data) values (p_data ->> 'id', (p_data ->> 'week')::date, p_data)
  on conflict (id) do update
    set week = excluded.week, data = excluded.data, updated_at = now(),
        status = case when hunts.status = 'approved' and hunts.data = excluded.data and hunts.week = excluded.week
                      then 'approved' else 'review' end;
end;
$$;

/** Approve, pause (hides it at once; progress is kept) or send back to review. */
create function public.admin_hunt_status(p_id text, p_status text) returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  if p_status not in ('review', 'approved', 'paused') then raise exception 'bad_status' using errcode = '22023'; end if;
  update public.hunts set status = p_status, updated_at = now() where id = p_id;
  if not found then raise exception 'unknown_hunt' using errcode = '22023'; end if;
end;
$$;

revoke all on function public.hunt_current() from public, anon, authenticated;
revoke all on function public.hunt_view(public.hunts, uuid) from public, anon, authenticated;
revoke all on function public.hunt_state() from public, anon;
revoke all on function public.hunt_join() from public, anon;
revoke all on function public.hunt_talk(text) from public, anon;
revoke all on function public.hunt_answer(int) from public, anon;
revoke all on function public.admin_hunt_list() from public, anon;
revoke all on function public.admin_hunt_upsert(jsonb) from public, anon;
revoke all on function public.admin_hunt_status(text, text) from public, anon;
grant execute on function public.hunt_state() to authenticated;
grant execute on function public.hunt_join() to authenticated;
grant execute on function public.hunt_talk(text) to authenticated;
grant execute on function public.hunt_answer(int) to authenticated;
grant execute on function public.admin_hunt_list() to authenticated;
grant execute on function public.admin_hunt_upsert(jsonb) to authenticated;
grant execute on function public.admin_hunt_status(text, text) to authenticated;
