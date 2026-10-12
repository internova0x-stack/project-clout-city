-- Clout City v0.4 "Stories": the World State layer, the News app's data, predictions,
-- story tasks and events, story management (approval, scheduling, pause/retire),
-- staging tools, location wave 2 and the "Who Killed Sarah Bird?" arcs as data.
-- The pilot is loaded and approved but NOT scheduled: its start date is set later
-- with admin_story_schedule (docs/STORIES.md).

-- Location wave 2, story-only Shop items and place tags, from lib/city.ts (scripts/gen-city-seed.ts).
update public.game_settings set value = '{"economy":{"shiftRate":120,"cloutPerDollar":0.6,"baseVisitClout":5,"cloutMultiplier":{"base":0.7,"mood":0.3,"confidence":0.3},"energy":{"dailyTopUp":20,"eventCost":20},"confidenceDriftPerDay":3,"dailyTasks":{"count":5,"rewardMin":40,"rewardMax":90,"bonus":150},"sellRate":0.6,"purchaseCloutDecay":0.85,"bills":{"every":"1 month","carRentalDays":7,"phone":85,"graceDays":3,"moodDropPerDay":8,"evictAfterDays":7,"carInsuranceRate":0.02},"gigs":{"side":{"confidence":0,"chance":0.9,"payMin":3,"payMax":5,"energy":1.5,"waitMinutes":60},"pro":{"confidence":50,"chance":0.5,"payMin":8,"payMax":10,"energy":2,"waitMinutes":120},"big":{"confidence":80,"chance":0.22,"payMin":15,"payMax":20,"energy":3,"waitMinutes":240}},"shiftEnergy":25},"places":[{"id":"velvet-static","tags":["club","nightlife","first_party_venue"],"story":null,"actions":[{"id":"visit","kind":"visit","price":60,"pay":0,"energy":15,"mood":6,"confidence":4,"clout":null,"storyUnlock":false}]},{"id":"grind-and-gossip","tags":["cafe","dining_medium","job_barista"],"story":null,"actions":[{"id":"eat","kind":"eat","price":18,"pay":0,"energy":-30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"shift","kind":"shift","price":0,"pay":120,"energy":25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"lucky-seven-deli","tags":["bodega","dining_budget"],"story":null,"actions":[{"id":"eat","kind":"eat","price":7,"pay":0,"energy":-15,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"altitude-718","tags":["rooftop","dining_luxury"],"story":null,"actions":[{"id":"eat","kind":"eat","price":95,"pay":0,"energy":-55,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"flushing-meadows","tags":["park","outdoors"],"story":null,"actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pedal-pushers","tags":["delivery_hub","job_delivery"],"story":null,"actions":[{"id":"shift","kind":"shift","price":0,"pay":135,"energy":30,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skybridge-tower","tags":["office","gigs_board"],"story":null,"actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"skyline-pier","tags":["skyline_pier","residential","waterfront"],"story":"sarah-bird","actions":[{"id":"lobby","kind":"visit","price":0,"pay":0,"energy":5,"mood":0,"confidence":0,"clout":null,"storyUnlock":false},{"id":"memorial","kind":"visit","price":0,"pay":0,"energy":2,"mood":4,"confidence":0,"clout":10,"storyUnlock":true}]},{"id":"hunters-pier","tags":["hunters_pier","waterfront","park"],"story":"sarah-bird","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":8,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"rockaway-diner","tags":["rockaway_diner","diner","dining_budget"],"story":"sarah-bird","actions":[{"id":"eat","kind":"eat","price":14,"pay":0,"energy":-25,"mood":0,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"radiant-harbor","tags":["radiant_harbor","church"],"story":"sarah-bird","actions":[{"id":"visit","kind":"visit","price":0,"pay":0,"energy":5,"mood":5,"confidence":0,"clout":null,"storyUnlock":false}]},{"id":"pressed-iron-gym","tags":["pressed_iron","gym"],"story":"sarah-bird","actions":[{"id":"workout","kind":"visit","price":15,"pay":0,"energy":20,"mood":3,"confidence":6,"clout":null,"storyUnlock":false}]}],"events":[{"id":"neon-nights","placeId":"velvet-static","startHour":22,"hours":5,"entry":80,"clout":60,"confidence":8,"mood":6},{"id":"golden-hour","placeId":"velvet-static","startHour":15,"hours":4,"entry":50,"clout":40,"confidence":6,"mood":8}],"gigs":{"side":["Be a professional crowd at a gallery opening","Stand in line for a sneaker drop","Laugh on cue at a comedy open mic","Hold a ring light at a rooftop shoot"],"pro":["Run a launch campaign for a $14 artisanal ice cube startup","Ghost-write a podcast host''s \"authentic\" origin story","Manage socials for a dog with 40k followers"],"big":["Write a speech for a councilmember candidate","Art-direct a perfume ad for a fictional heiress"]},"shop":[{"sku":"fit-satin-bomber","category":"fashion","price":180,"clout":25,"rentPerWeek":0,"slot":"top","storyOnly":false},{"sku":"fit-leather-blazer","category":"fashion","price":420,"clout":45,"rentPerWeek":0,"slot":"top","storyOnly":false},{"sku":"fit-varsity-tee","category":"fashion","price":65,"clout":10,"rentPerWeek":0,"slot":"top","storyOnly":false},{"sku":"fit-wide-trousers","category":"fashion","price":140,"clout":18,"rentPerWeek":0,"slot":"bottom","storyOnly":false},{"sku":"fit-mini-skirt","category":"fashion","price":120,"clout":16,"rentPerWeek":0,"slot":"bottom","storyOnly":false},{"sku":"fit-chunky-sneakers","category":"fashion","price":210,"clout":28,"rentPerWeek":0,"slot":"shoes","storyOnly":false},{"sku":"forever-our-bird-hoodie","category":"fashion","price":85,"clout":12,"rentPerWeek":0,"slot":"top","storyOnly":true},{"sku":"fit-bucket-hat","category":"fashion","price":55,"clout":8,"rentPerWeek":0,"slot":"accessory","storyOnly":false},{"sku":"car-hatchback","category":"cars","price":14000,"clout":120,"rentPerWeek":350,"slot":null,"storyOnly":false},{"sku":"car-luxury-sedan","category":"cars","price":52000,"clout":300,"rentPerWeek":900,"slot":null,"storyOnly":false},{"sku":"car-electric-coupe","category":"cars","price":78000,"clout":420,"rentPerWeek":1300,"slot":null,"storyOnly":false},{"sku":"house-astoria-townhouse","category":"houses","price":180000,"clout":900,"rentPerWeek":0,"slot":null,"storyOnly":false},{"sku":"house-lic-penthouse","category":"houses","price":650000,"clout":2400,"rentPerWeek":0,"slot":null,"storyOnly":false},{"sku":"lux-gold-chain","category":"luxury","price":900,"clout":70,"rentPerWeek":0,"slot":null,"storyOnly":false},{"sku":"lux-diamond-studs","category":"luxury","price":2400,"clout":140,"rentPerWeek":0,"slot":null,"storyOnly":false},{"sku":"lux-designer-watch","category":"luxury","price":6800,"clout":260,"rentPerWeek":0,"slot":null,"storyOnly":false},{"sku":"mu-glow-kit","category":"makeup","price":75,"clout":12,"rentPerWeek":0,"slot":null,"storyOnly":false},{"sku":"mu-lip-set","category":"makeup","price":95,"clout":14,"rentPerWeek":0,"slot":null,"storyOnly":false},{"sku":"mu-lash-bar","category":"makeup","price":160,"clout":20,"rentPerWeek":0,"slot":null,"storyOnly":false}],"homeLocations":{"astoria_studio":[40.7745,-73.905],"jackson_heights_1br":[40.752,-73.883],"lic_highrise":[40.747,-73.956]}}'::jsonb, updated_at = now() where key = 'city';

-- ===========================================================================
-- World State layer (World State Layer Brief v2).
--
-- Global world state is derived, not stored: a pure function of the arc rows
-- (content, status, start date) and the New York clock. Only per-player
-- progress is stored. Story content lives in story_arcs, which clients can't
-- read (it carries answer keys); players get a filtered feed from story_feed().
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.story_arcs (
  id            text primary key,
  parent_id     text references public.story_arcs (id),
  type          text not null check (type in ('main', 'side')),
  tier          text not null check (tier in ('free', 'premium')),
  sku           text,
  -- Pause or retire switch: anything but 'active' hides the arc immediately.
  status        text not null default 'active' check (status in ('active', 'paused', 'retired')),
  -- Approval gate: only approved arcs can be scheduled or shown to players.
  review_status text not null default 'draft' check (review_status in ('draft', 'approved', 'declined')),
  review_note   text,
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  -- Day 1 on the New York calendar. Null means not scheduled. Side arcs follow their parent.
  start_at      date,
  data          jsonb not null,
  updated_at    timestamptz not null default now()
);
alter table public.story_arcs enable row level security; -- no policies: server functions only

create table public.story_admins (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.story_admins enable row level security;

create table public.story_beats_seen (
  player_id uuid not null references public.players (id) on delete cascade,
  beat_id   text not null,
  seen_at   timestamptz not null default now(),
  primary key (player_id, beat_id)
);

create table public.story_votes (
  player_id     uuid not null references public.players (id) on delete cascade,
  prediction_id text not null,
  option_id     text not null,
  updated_at    timestamptz not null default now(),
  primary key (player_id, prediction_id)
);
create index story_votes_prediction_idx on public.story_votes (prediction_id, option_id);

create table public.story_shadow_guesses (
  player_id     uuid not null references public.players (id) on delete cascade,
  prediction_id text not null,
  option_id     text not null,
  created_at    timestamptz not null default now(),
  primary key (player_id, prediction_id)
);

create table public.player_badges (
  player_id uuid not null references public.players (id) on delete cascade,
  badge_id  text not null,
  arc_id    text not null,
  earned_at timestamptz not null default now(),
  primary key (player_id, badge_id)
);

create table public.story_task_done (
  player_id uuid not null references public.players (id) on delete cascade,
  task_id   text not null,
  done_at   timestamptz not null default now(),
  primary key (player_id, task_id)
);

-- Granted only by the Stripe webhook (v0.5); read by has_entitlement().
create table public.entitlements (
  player_id         uuid not null references public.players (id) on delete cascade,
  sku               text not null,
  product_type      text not null,
  status            text not null default 'active' check (status in ('active', 'revoked')),
  stripe_session_id text,
  stripe_payment_id text,
  created_at        timestamptz not null default now(),
  primary key (player_id, sku)
);

alter table public.story_beats_seen enable row level security;
alter table public.story_votes enable row level security;
alter table public.story_shadow_guesses enable row level security;
alter table public.player_badges enable row level security;
alter table public.story_task_done enable row level security;
alter table public.entitlements enable row level security;
create policy "own seen" on public.story_beats_seen for select to authenticated using (player_id = auth.uid());
create policy "own votes" on public.story_votes for select to authenticated using (player_id = auth.uid());
create policy "own shadow guesses" on public.story_shadow_guesses for select to authenticated using (player_id = auth.uid());
create policy "own badges" on public.player_badges for select to authenticated using (player_id = auth.uid());
create policy "own story tasks" on public.story_task_done for select to authenticated using (player_id = auth.uid());
create policy "own entitlements" on public.entitlements for select to authenticated using (player_id = auth.uid());

alter table public.gig_offers add column story_id text;

-- ---------------------------------------------------------------------------
-- Clock and arc helpers
-- ---------------------------------------------------------------------------
create function public.arc_start(p_arc public.story_arcs) returns date
language sql stable security definer set search_path = public
as $$ select case when p_arc.type = 'side' then (select start_at from public.story_arcs where id = p_arc.parent_id) else p_arc.start_at end $$;

/** Story day (1-based) of an arc today, or null when it isn't live for players. */
create function public.arc_day(p_arc public.story_arcs) returns int
language sql stable security definer set search_path = public
as $$
  select case
    when p_arc.status <> 'active' or p_arc.review_status <> 'approved' then null
    when p_arc.type = 'side' and not exists (select 1 from public.story_arcs m where m.id = p_arc.parent_id and m.status = 'active' and m.review_status = 'approved') then null
    when public.arc_start(p_arc) is null or public.ny_today() < public.arc_start(p_arc) then null
    else public.ny_today() - public.arc_start(p_arc) + 1
  end
$$;

create function public.arc_last_day(p_arc public.story_arcs) returns int
language sql immutable
as $$ select coalesce(max((b ->> 'day')::int), 0) from jsonb_array_elements(p_arc.data -> 'beats') b $$;

/** A New York wall-clock time on a story day. */
create function public.story_time(p_start date, p_day int, p_time text default '00:00') returns timestamptz
language sql immutable
as $$ select ((p_start + p_day - 1) + p_time::time) at time zone 'America/New_York' $$;

create function public.arc_started(p_arc_id text) returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select public.arc_day(a) is not null from public.story_arcs a where a.id = p_arc_id), false) $$;

create function public.has_entitlement(p_player uuid, p_sku text) returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.entitlements where player_id = p_player and sku = p_sku and status = 'active') $$;

-- ---------------------------------------------------------------------------
-- Effects in force today (main arcs only: side-arc effects are personal-layer)
-- ---------------------------------------------------------------------------
create function public.world_effects()
returns table (arc_id text, beat_id text, beat_day int, story_day int, effect jsonb)
language sql stable security definer set search_path = public
as $$
  select a.id, b ->> 'id', (b ->> 'day')::int, d.sd, e
    from public.story_arcs a
   cross join lateral (select public.arc_day(a) as sd) d
   cross join lateral jsonb_array_elements(a.data -> 'beats') b
   cross join lateral jsonb_array_elements(coalesce(b -> 'effects', '[]')) e
   where a.type = 'main' and d.sd is not null
     and coalesce(b ->> 'status', 'active') = 'active'
     and (b ->> 'day')::int <= d.sd
     and d.sd < coalesce((e ->> 'expires_day')::int,
                         case when e ->> 'type' = 'task_injection' then (b ->> 'day')::int + 1 end,
                         2147483647)
$$;

/** Highest matching multiplier, capped at 2x, with its reason. Clout never uses it. */
create function public.story_price(p_tags jsonb, p_kind text, out multiplier numeric, out reason text)
language sql stable security definer set search_path = public
as $$
  select coalesce(max(least(2, (effect ->> 'multiplier')::numeric)), 1),
         (array_agg(effect ->> 'reason' order by (effect ->> 'multiplier')::numeric desc))[1]
    from public.world_effects()
   where effect ->> 'type' = 'price_multiplier' and effect ->> 'applies_to' = p_kind
     and (effect -> 'tags') ?| array(select jsonb_array_elements_text(coalesce(p_tags, '[]')))
$$;

/** Closures override everything; then restrictions; then "open" (story-only items). */
create function public.story_availability(p_tags jsonb, p_sku text, out state text, out reason text, out allow jsonb)
language sql stable security definer set search_path = public
as $$
  with hits as (
    select effect from public.world_effects()
     where effect ->> 'type' = 'availability'
       and ((p_sku is not null and effect ->> 'sku' = p_sku)
            or (p_tags is not null and (effect -> 'tags') ?| array(select jsonb_array_elements_text(p_tags))))
  )
  select coalesce(
           (select 'closed' from hits where effect ->> 'state' = 'closed' limit 1),
           (select 'restricted' from hits where effect ->> 'state' = 'restricted' limit 1),
           (select 'open' from hits where effect ->> 'state' = 'open' limit 1),
           'default'),
         coalesce(
           (select effect ->> 'reason' from hits where effect ->> 'state' = 'closed' limit 1),
           (select effect ->> 'reason' from hits where effect ->> 'state' = 'restricted' limit 1),
           (select effect ->> 'reason' from hits where effect ->> 'state' = 'open' limit 1)),
         (select effect -> 'allow' from hits where effect ->> 'state' = 'restricted' limit 1)
$$;

create function public.story_flag(p_flag text) returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.world_effects() where effect ->> 'type' = 'flag' and effect ->> 'set' = p_flag) $$;

create function public.story_unlocked(p_place text, p_action text) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.world_effects()
                  where effect ->> 'type' = 'place_state' and effect ->> 'place' = p_place and effect ->> 'unlock_action' = p_action)
$$;

/** A spawned story event in force today, with cancelled = true once a beat cancels it. */
create function public.story_event(p_event text) returns jsonb
language sql stable security definer set search_path = public
as $$
  select ev || jsonb_build_object(
           'arc', w.arc_id,
           'cancelled', exists (select 1 from public.world_effects() c where c.effect ->> 'type' = 'place_state' and c.effect ->> 'cancel_event' = p_event))
    from public.world_effects() w
    join public.story_arcs a on a.id = w.arc_id
   cross join lateral jsonb_array_elements(a.data -> 'events') ev
   where w.effect ->> 'type' = 'place_state' and w.effect ->> 'spawn_event' = p_event and ev ->> 'id' = p_event
   limit 1
$$;

/** Story tasks offered today: injected by a beat and not yet expired. */
create function public.story_tasks_today()
returns table (arc_id text, task jsonb)
language sql stable security definer set search_path = public
as $$
  select distinct on (t ->> 'id') w.arc_id, t
    from public.world_effects() w
    join public.story_arcs a on a.id = w.arc_id
   cross join lateral jsonb_array_elements_text(coalesce(w.effect -> 'add', '[]')) added(id)
   cross join lateral jsonb_array_elements(coalesce(a.data -> 'tasks', '[]')) t
   where w.effect ->> 'type' = 'task_injection' and t ->> 'id' = added.id
     and not exists (select 1 from public.world_effects() r
                      where r.effect ->> 'type' = 'task_injection' and r.effect -> 'remove' ? added.id and r.beat_day > w.beat_day)
$$;

/**
 * Completes the story task matching what the player just did, once ever, and
 * pays its clout. p_kind: place (target = place id, action = action id), event,
 * share or evidence (target = beat id).
 */
create function public.story_complete(p_player uuid, p_kind text, p_target text, p_action text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  t record;
  v_clout int;
  done jsonb := '[]';
begin
  for t in select * from public.story_tasks_today() loop
    if (p_kind = 'place' and t.task -> 'do' ->> 'place' = p_target and t.task -> 'do' ->> 'action' = p_action)
       or (p_kind in ('event', 'share', 'evidence') and t.task -> 'do' ->> p_kind = p_target) then
      insert into public.story_task_done (player_id, task_id) values (p_player, t.task ->> 'id') on conflict do nothing;
      if found then
        v_clout := coalesce((t.task ->> 'clout')::int, 0);
        if v_clout > 0 and public.ledger_once(p_player, 'clout', v_clout, 'story_task', t.task ->> 'id') then
          update public.players set clout = clout + v_clout where id = p_player;
        end if;
        done := done || jsonb_build_object('id', t.task ->> 'id', 'label', t.task ->> 'label', 'clout', v_clout);
      end if;
    end if;
  end loop;
  return done;
end;
$$;

-- ---------------------------------------------------------------------------
-- Predictions
-- ---------------------------------------------------------------------------
create function public.story_predictions()
returns table (arc_id text, beat_id text, beat_day int, story_day int, pred jsonb, opens_at timestamptz, closes_at timestamptz, reveals_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select a.id, b ->> 'id', (b ->> 'day')::int, public.arc_day(a), b -> 'prediction',
         public.story_time(public.arc_start(a), (b ->> 'day')::int),
         public.story_time(public.arc_start(a), (b -> 'prediction' -> 'closes_at' ->> 'day')::int, b -> 'prediction' -> 'closes_at' ->> 'time') + interval '59.999 seconds',
         (select public.story_time(public.arc_start(a), (r ->> 'day')::int)
            from jsonb_array_elements(a.data -> 'beats') r
           where r ->> 'id' = b -> 'prediction' ->> 'reveal_beat' and coalesce(r ->> 'status', 'active') = 'active')
    from public.story_arcs a
   cross join lateral jsonb_array_elements(a.data -> 'beats') b
   where a.type = 'main' and public.arc_day(a) is not null
     and b ? 'prediction' and coalesce(b ->> 'status', 'active') = 'active'
     and (b ->> 'day')::int <= public.arc_day(a)
$$;

create function public.vote_prediction(p_prediction text, p_option text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p record;
begin
  select * into p from public.story_predictions() where pred ->> 'id' = p_prediction;
  if p.pred is null then raise exception 'unknown_prediction' using errcode = '22023'; end if;
  if public.game_now() < p.opens_at or public.game_now() > p.closes_at then raise exception 'voting_closed' using errcode = '22023'; end if;
  if not exists (select 1 from jsonb_array_elements(p.pred -> 'options') o where o ->> 'id' = p_option) then
    raise exception 'unknown_option' using errcode = '22023';
  end if;
  if coalesce((p.pred ->> 'changeable')::boolean, true) then
    insert into public.story_votes (player_id, prediction_id, option_id) values (uid, p_prediction, p_option)
    on conflict (player_id, prediction_id) do update set option_id = excluded.option_id, updated_at = now();
  else
    insert into public.story_votes (player_id, prediction_id, option_id) values (uid, p_prediction, p_option)
    on conflict do nothing;
  end if;
end;
$$;

/** Pays prediction clout and badges once each, after the reveal. Idempotent. */
create function public.claim_story_rewards(p_player uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  p record;
  a public.story_arcs;
  v_clout int;
  req text[];
begin
  for p in select sp.*, v.option_id from public.story_predictions() sp
             join public.story_votes v on v.prediction_id = sp.pred ->> 'id' and v.player_id = p_player
            where sp.reveals_at is not null and public.game_now() >= sp.reveals_at and v.option_id = sp.pred ->> 'correct' loop
    v_clout := coalesce((p.pred -> 'reward' ->> 'clout')::int, 0);
    if v_clout > 0 and public.ledger_once(p_player, 'clout', v_clout, 'prediction', p.pred ->> 'id') then
      update public.players set clout = clout + v_clout where id = p_player;
    end if;
    if p.pred -> 'reward' ? 'badge' then
      insert into public.player_badges (player_id, badge_id, arc_id) values (p_player, p.pred -> 'reward' ->> 'badge', p.arc_id) on conflict do nothing;
    end if;
  end loop;
  -- Bonus badge (e.g. "Lola's Favorite" for all three right).
  for a in select * from public.story_arcs where type = 'main' and data ? 'bonus_badge' and public.arc_day(story_arcs) is not null loop
    req := array(select jsonb_array_elements_text(a.data -> 'bonus_badge' -> 'requires'));
    if (select count(*) from public.story_predictions() sp
          join public.story_votes v on v.prediction_id = sp.pred ->> 'id' and v.player_id = p_player
         where sp.pred ->> 'id' = any (req) and sp.reveals_at is not null and public.game_now() >= sp.reveals_at
           and v.option_id = sp.pred ->> 'correct') = cardinality(req) then
      insert into public.player_badges (player_id, badge_id, arc_id) values (p_player, a.data -> 'bonus_badge' ->> 'badge', a.id) on conflict do nothing;
    end if;
  end loop;
end;
$$;

/** Archive only: a guess for a finished arc's prediction the player never voted on. Badge, no clout. */
create function public.shadow_guess(p_prediction text, p_option text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p record;
  a public.story_arcs;
  right_answer boolean;
begin
  select * into p from public.story_predictions() where pred ->> 'id' = p_prediction;
  if p.pred is null then raise exception 'unknown_prediction' using errcode = '22023'; end if;
  select * into a from public.story_arcs where id = p.arc_id;
  if p.story_day <= public.arc_last_day(a) then raise exception 'not_archived' using errcode = '22023'; end if;
  if exists (select 1 from public.story_votes where player_id = uid and prediction_id = p_prediction) then
    raise exception 'already_voted' using errcode = '22023';
  end if;
  if not exists (select 1 from jsonb_array_elements(p.pred -> 'options') o where o ->> 'id' = p_option) then
    raise exception 'unknown_option' using errcode = '22023';
  end if;
  insert into public.story_shadow_guesses (player_id, prediction_id, option_id) values (uid, p_prediction, p_option);
  right_answer := p_option = p.pred ->> 'correct';
  if right_answer and a.data ? 'shadow_badge' then
    insert into public.player_badges (player_id, badge_id, arc_id) values (uid, a.data ->> 'shadow_badge', a.id) on conflict do nothing;
  end if;
  return jsonb_build_object('correct', p.pred ->> 'correct', 'right', right_answer);
end;
$$;

-- ---------------------------------------------------------------------------
-- Player-facing story actions
-- ---------------------------------------------------------------------------
create function public.mark_beat_seen(p_beat text)
returns void
language sql security definer set search_path = public
as $$ insert into public.story_beats_seen (player_id, beat_id) values (auth.uid(), p_beat) on conflict do nothing $$;

/** Share and evidence tasks are completed from the client (they can't be observed server-side). */
create function public.complete_story_task(p_task text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  t jsonb;
begin
  select task into t from public.story_tasks_today() where task ->> 'id' = p_task;
  if t is null then raise exception 'task_unavailable' using errcode = '22023'; end if;
  if t -> 'do' ? 'share' then return public.story_complete(auth.uid(), 'share', t -> 'do' ->> 'share'); end if;
  if t -> 'do' ? 'evidence' then return public.story_complete(auth.uid(), 'evidence', t -> 'do' ->> 'evidence'); end if;
  raise exception 'task_needs_action' using errcode = '22023';
end;
$$;

/** Free story events (e.g. the vigil): attend once, Energy cost, clout scaled by Mood and Confidence. */
create function public.attend_story_event(p_event text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ev jsonb := public.story_event(p_event);
  me public.players;
  v_energy int;
  v_clout int;
  v_mood int;
  done jsonb;
begin
  if ev is null or (ev ->> 'cancelled')::boolean then raise exception 'event_unavailable' using errcode = '22023'; end if;
  if not coalesce((ev ->> 'attendable')::boolean, false) then raise exception 'event_not_open' using errcode = '22023'; end if;
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  v_energy := coalesce((ev ->> 'energy')::int, 0);
  if me.energy < v_energy then raise exception 'no_energy' using errcode = '22023'; end if;
  insert into public.event_attendance (player_id, event_id, ny_date) values (uid, p_event, public.ny_today()) on conflict do nothing;
  if not found then raise exception 'already_attended' using errcode = '22023'; end if;
  v_clout := round(coalesce((ev ->> 'clout')::int, 0) * public.clout_multiplier(me.mood, me.confidence));
  v_mood := coalesce((ev ->> 'mood')::int, 0);
  if not public.ledger_once(uid, 'clout', v_clout, 'story_event', p_event) then v_clout := 0; end if;
  update public.players
     set energy = greatest(0, energy - v_energy), clout = clout + v_clout, mood = least(100, mood + v_mood)
   where id = uid;
  done := public.story_complete(uid, 'event', p_event);
  return jsonb_build_object('clout', v_clout, 'energy', -v_energy, 'mood', v_mood, 'storyTasks', done);
end;
$$;

-- ---------------------------------------------------------------------------
-- The player's story feed: everything the News app and the world need, with
-- nothing that points at an open answer (no answer keys, no correct options
-- before the reveal, no unreleased beats, no locked side-arc text).
-- ---------------------------------------------------------------------------
create function public.story_feed()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  now_t timestamptz := public.game_now();
  arcs jsonb := '[]';
  a public.story_arcs;
  sd int;
  entitled boolean;
  beats jsonb;
  preds jsonb;
  finished boolean;
  topics jsonb;
begin
  perform public.claim_story_rewards(uid);
  for a in select * from public.story_arcs order by type, id loop
    sd := public.arc_day(a);
    continue when sd is null;
    entitled := a.type = 'main' or public.has_entitlement(uid, a.sku);
    finished := sd > public.arc_last_day(a);
    select coalesce(jsonb_agg(
             jsonb_build_object(
               'id', b ->> 'id', 'day', (b ->> 'day')::int,
               'headline', b -> 'news' -> 0 ->> 'headline',
               'locked', not entitled,
               'seen', exists (select 1 from public.story_beats_seen s where s.player_id = uid and s.beat_id = b ->> 'id'))
             || case when entitled then jsonb_strip_nulls(jsonb_build_object(
                  'body', b -> 'news' -> 0 ->> 'body',
                  'hook', b -> 'news' -> 0 ->> 'hook',
                  'previously', b -> 'news' -> 0 ->> 'previously',
                  'cardNote', b ->> 'card_note',
                  'evidence', b -> 'evidence',
                  'pointsAtAnswer', (b ->> 'points_at_answer')::boolean)) else '{}'::jsonb end
             order by (b ->> 'day')::int), '[]')
      into beats
      from jsonb_array_elements(a.data -> 'beats') b
     where coalesce(b ->> 'status', 'active') = 'active' and (b ->> 'day')::int <= sd;

    select coalesce(jsonb_agg(
             jsonb_strip_nulls(jsonb_build_object(
               'id', p.pred ->> 'id', 'beatId', p.beat_id, 'question', p.pred ->> 'question', 'options', p.pred -> 'options',
               'reward', p.pred -> 'reward', 'closesAt', p.closes_at, 'revealsAt', p.reveals_at,
               'state', case when now_t <= p.closes_at then 'open'
                             when p.reveals_at is null or now_t < p.reveals_at then 'closed' else 'revealed' end,
               'myVote', v.option_id,
               'shadowGuess', g.option_id,
               -- Live results after voting, and for everyone once voting closes.
               'results', case when v.option_id is not null or now_t > p.closes_at then (
                   select jsonb_build_object('total', count(*), 'counts', coalesce(jsonb_object_agg(x.option_id, x.n), '{}'))
                     from (select option_id, count(*) as n from public.story_votes where prediction_id = p.pred ->> 'id' group by option_id) x
                 ) end,
               'correct', case when p.reveals_at is not null and now_t >= p.reveals_at
                                 and (not finished or v.option_id is not null or g.option_id is not null)
                               then p.pred ->> 'correct' end,
               'roast', case when p.reveals_at is not null and now_t >= p.reveals_at and v.option_id is not null and v.option_id <> p.pred ->> 'correct'
                             then p.pred -> 'roasts' ->> v.option_id end))
             order by p.beat_day), '[]')
      into preds
      from public.story_predictions() p
      left join public.story_votes v on v.player_id = uid and v.prediction_id = p.pred ->> 'id'
      left join public.story_shadow_guesses g on g.player_id = uid and g.prediction_id = p.pred ->> 'id'
     where p.arc_id = a.id;

    arcs := arcs || jsonb_strip_nulls(jsonb_build_object(
      'id', a.id, 'title', a.data ->> 'title', 'type', a.type, 'kind', a.data ->> 'kind', 'tier', a.tier, 'sku', a.sku,
      'parent', a.parent_id, 'teaser', a.data ->> 'teaser', 'emoji', a.data ->> 'emoji', 'prompt', a.data ->> 'prompt',
      'day', sd, 'lastDay', public.arc_last_day(a), 'finished', finished, 'entitled', entitled,
      'beats', beats, 'predictions', preds, 'badges', a.data -> 'badges'));
  end loop;

  -- Up to two chatter topics, by priority; the latest phase wins within a topic.
  select coalesce(jsonb_agg(t order by (t ->> 'priority')::int desc), '[]') into topics from (
    select distinct on (effect ->> 'topic')
           jsonb_build_object('topic', effect ->> 'topic', 'phase', effect ->> 'phase', 'priority', coalesce((effect ->> 'priority')::int, 1),
                              'lines', (select data -> 'chatter' -> (effect ->> 'topic') -> (effect ->> 'phase') from public.story_arcs where id = arc_id)) as t
      from public.world_effects()
     where effect ->> 'type' = 'chatter_topic'
     order by effect ->> 'topic', beat_day desc
     limit 2
  ) s;

  return jsonb_build_object(
    'today', public.ny_today(),
    'arcs', arcs,
    'effects', (select coalesce(jsonb_agg(jsonb_build_object('arc', arc_id, 'beat', beat_id, 'effect', effect - 'add' - 'remove')), '[]')
                  from public.world_effects() where effect ->> 'type' in ('price_multiplier', 'availability', 'place_state', 'flag')),
    'events', (select coalesce(jsonb_agg(public.story_event(effect ->> 'spawn_event')), '[]')
                 from public.world_effects() where effect ->> 'type' = 'place_state' and effect ? 'spawn_event'),
    'tasks', (select coalesce(jsonb_agg(task || jsonb_build_object('arc', arc_id, 'done',
                       exists (select 1 from public.story_task_done d where d.player_id = uid and d.task_id = task ->> 'id'))), '[]')
                from public.story_tasks_today()),
    'chatter', topics,
    'badges', (select coalesce(jsonb_agg(jsonb_build_object('id', pb.badge_id, 'arc', pb.arc_id, 'earnedAt', pb.earned_at)), '[]')
                 from public.player_badges pb where pb.player_id = uid),
    'startedArcs', (select coalesce(jsonb_agg(id), '[]') from public.story_arcs a2 where public.arc_day(a2) is not null)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Story management (admins): add or update an arc, approve or decline it,
-- schedule its start, pause or retire arcs and beats. Admins are listed in
-- story_admins (see docs/SETUP.md). The admin screen calls these; they also
-- work from the Supabase SQL Editor.
-- ---------------------------------------------------------------------------
create function public.is_story_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.story_admins where user_id = auth.uid()) $$;

create function public.require_story_admin() returns void
language plpgsql stable security definer set search_path = public
as $$ begin if not public.is_story_admin() then raise exception 'not_admin' using errcode = '42501'; end if; end $$;

/** Adds or replaces an arc's content (validated by the app first). Changed content goes back to draft unless it's live. */
create function public.admin_story_upsert(p_data jsonb)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  cur public.story_arcs;
  id_ text := p_data ->> 'id';
begin
  perform public.require_story_admin();
  if id_ is null or p_data ->> 'type' not in ('main', 'side') or jsonb_typeof(p_data -> 'beats') <> 'array' then
    raise exception 'bad_arc' using errcode = '22023';
  end if;
  select * into cur from public.story_arcs where id = id_;
  if cur.id is not null and public.arc_day(cur) is not null then raise exception 'arc_is_live' using errcode = '22023'; end if;
  insert into public.story_arcs (id, parent_id, type, tier, sku, data, review_status)
  values (id_, p_data ->> 'parent_arc_id', p_data ->> 'type', p_data ->> 'tier', p_data ->> 'sku', p_data, 'draft')
  on conflict (id) do update
     set parent_id = excluded.parent_id, type = excluded.type, tier = excluded.tier, sku = excluded.sku, data = excluded.data,
         review_status = case when story_arcs.data = excluded.data then story_arcs.review_status else 'draft' end,
         updated_at = now();
  return id_;
end;
$$;

create function public.admin_story_review(p_arc text, p_decision text, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  if p_decision not in ('approved', 'declined', 'draft') then raise exception 'bad_decision' using errcode = '22023'; end if;
  update public.story_arcs
     set review_status = p_decision, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now(),
         start_at = case when p_decision = 'approved' then start_at else null end, updated_at = now()
   where id = p_arc;
  if not found then raise exception 'unknown_arc' using errcode = '22023'; end if;
end;
$$;

/** Sets Day 1 (or null to unschedule). Approved main arcs only, on their start weekday, never in the past. */
create function public.admin_story_schedule(p_arc text, p_start date)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  a public.story_arcs;
  wd text;
begin
  perform public.require_story_admin();
  select * into a from public.story_arcs where id = p_arc for update;
  if a.id is null then raise exception 'unknown_arc' using errcode = '22023'; end if;
  if a.type <> 'main' then raise exception 'side_arcs_follow_parent' using errcode = '22023'; end if;
  if p_start is not null then
    if a.review_status <> 'approved' then raise exception 'not_approved' using errcode = '22023'; end if;
    if p_start < public.ny_today() then raise exception 'start_in_past' using errcode = '22023'; end if;
    wd := trim(to_char(p_start, 'fmday'));
    if a.data ? 'start_weekday' and wd <> a.data ->> 'start_weekday' then raise exception 'wrong_weekday' using errcode = '22023'; end if;
    if exists (select 1 from public.story_arcs o
                where o.id <> a.id and o.type = 'main' and o.start_at is not null and o.status = 'active'
                  and o.start_at + public.arc_last_day(o) - 1 = p_start + public.arc_last_day(a) - 1) then
      raise exception 'finale_collision' using errcode = '22023';
    end if;
  elsif public.arc_day(a) is not null then
    raise exception 'arc_is_live' using errcode = '22023';
  end if;
  update public.story_arcs set start_at = p_start, updated_at = now() where id = p_arc;
end;
$$;

create function public.admin_story_status(p_arc text, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  update public.story_arcs set status = p_status, updated_at = now() where id = p_arc;
  if not found then raise exception 'unknown_arc' using errcode = '22023'; end if;
end;
$$;

create function public.admin_beat_status(p_arc text, p_beat text, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  if p_status not in ('active', 'paused', 'retired') then raise exception 'bad_status' using errcode = '22023'; end if;
  update public.story_arcs
     set data = jsonb_set(data, '{beats}', (
           select jsonb_agg(case when b ->> 'id' = p_beat then jsonb_set(b, '{status}', to_jsonb(p_status)) else b end order by ord)
             from jsonb_array_elements(data -> 'beats') with ordinality as x(b, ord))),
         updated_at = now()
   where id = p_arc and data -> 'beats' @> jsonb_build_array(jsonb_build_object('id', p_beat));
  if not found then raise exception 'unknown_beat' using errcode = '22023'; end if;
end;
$$;

/** Everything an admin needs: every arc with its review state, schedule, live day and prediction tallies. */
create function public.admin_story_list()
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'title', a.data ->> 'title', 'type', a.type, 'tier', a.tier, 'sku', a.sku, 'parent', a.parent_id,
      'status', a.status, 'review', a.review_status, 'reviewNote', a.review_note, 'reviewedAt', a.reviewed_at,
      'startAt', public.arc_start(a), 'day', public.arc_day(a), 'lastDay', public.arc_last_day(a), 'updatedAt', a.updated_at,
      'startWeekday', a.data ->> 'start_weekday',
      'beats', (select jsonb_agg(jsonb_build_object('id', b ->> 'id', 'day', (b ->> 'day')::int, 'headline', b -> 'news' -> 0 ->> 'headline',
                                                     'status', coalesce(b ->> 'status', 'active'), 'prediction', b -> 'prediction' ->> 'id'))
                  from jsonb_array_elements(a.data -> 'beats') b),
      'votes', (select coalesce(jsonb_object_agg(prediction_id, n), '{}') from (
                  select v.prediction_id, count(*) as n from public.story_votes v
                   where v.prediction_id in (select b -> 'prediction' ->> 'id' from jsonb_array_elements(a.data -> 'beats') b where b ? 'prediction')
                   group by v.prediction_id) t)
    ) order by a.type, a.id), '[]') from public.story_arcs a);
end;
$$;

/** Full content of one arc, for the admin editor and preview (answer key included: admins only). */
create function public.admin_story_get(p_arc text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_story_admin();
  return (select data from public.story_arcs where id = p_arc);
end;
$$;

-- ---------------------------------------------------------------------------
-- Staging tools (only while game_settings dev.tools is on)
-- ---------------------------------------------------------------------------
create function public.require_dev_tools() returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if coalesce((select (value ->> 'tools')::boolean from public.game_settings where key = 'dev'), false) is not true then
    raise exception 'dev_tools_off' using errcode = '42501';
  end if;
end;
$$;

/** Starts an arc on a chosen day for testing (any weekday), approving it if needed. Null unschedules. */
create function public.dev_story_start(p_arc text, p_start date)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_dev_tools();
  update public.story_arcs set start_at = p_start, review_status = 'approved', updated_at = now() where id = p_arc and type = 'main';
  if not found then raise exception 'unknown_arc' using errcode = '22023'; end if;
end;
$$;

create function public.dev_grant_entitlement(p_sku text, p_on boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_dev_tools();
  if p_on then
    insert into public.entitlements (player_id, sku, product_type, status) values (auth.uid(), p_sku, 'side_arc', 'active')
    on conflict (player_id, sku) do update set status = 'active';
  else
    update public.entitlements set status = 'revoked' where player_id = auth.uid() and sku = p_sku;
  end if;
end;
$$;

/** The debug panel: arcs, beats in force, effects, flags and prediction windows (with answers: staging only). */
create function public.story_debug()
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_dev_tools();
  return jsonb_build_object(
    'now', public.game_now(), 'today', public.ny_today(),
    'arcs', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'status', status, 'review', review_status, 'startAt', public.arc_start(a),
                                                          'day', public.arc_day(a), 'lastDay', public.arc_last_day(a)) order by type, id), '[]')
               from public.story_arcs a),
    'effects', (select coalesce(jsonb_agg(jsonb_build_object('arc', arc_id, 'beat', beat_id, 'day', beat_day, 'effect', effect)), '[]') from public.world_effects()),
    'flags', (select coalesce(jsonb_agg(effect ->> 'set'), '[]') from public.world_effects() where effect ->> 'type' = 'flag'),
    'predictions', (select coalesce(jsonb_agg(jsonb_build_object('id', pred ->> 'id', 'opens', opens_at, 'closes', closes_at, 'reveals', reveals_at,
                                                                 'correct', pred ->> 'correct',
                                                                 'votes', (select count(*) from public.story_votes v where v.prediction_id = pred ->> 'id'))), '[]')
                      from public.story_predictions())
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- Existing systems now ask the world state (prices, closures, story tasks)
-- ---------------------------------------------------------------------------
create or replace function public.do_action(p_place text, p_action text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  a jsonb := public.place_action(p_place, p_action);
  v_kind text := a ->> 'kind';
  v_price int := coalesce((a ->> 'price')::int, 0);
  v_pay int := coalesce((a ->> 'pay')::int, 0);
  v_energy int := coalesce((a ->> 'energy')::int, 0);
  e jsonb := public.city() -> 'economy';
  today date := public.ny_today();
  me public.players;
  first_today boolean;
  n int;
  v_clout int := 0;
  v_mood int := 0;
  v_conf int := 0;
  task_cash int;
  place jsonb := (select p from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = p_place);
  av record;
  pm record;
  v_paid int;
  story_done jsonb := '[]';
begin
  if a is null then raise exception 'unknown_action' using errcode = '22023'; end if;
  -- Story places exist only once their arc has started; story-unlock actions need their effect.
  if place ->> 'story' is not null and not public.arc_started(place ->> 'story') then raise exception 'unknown_action' using errcode = '22023'; end if;
  if coalesce((a ->> 'storyUnlock')::boolean, false) and not public.story_unlocked(p_place, p_action) then
    raise exception 'unknown_action' using errcode = '22023';
  end if;
  select * into av from public.story_availability(place -> 'tags', null);
  if av.state = 'closed' then raise exception 'place_closed: %', av.reason using errcode = '22023'; end if;
  if av.state = 'restricted' and not coalesce(av.allow ? p_action, false) then raise exception 'place_restricted: %', av.reason using errcode = '22023'; end if;
  if v_kind = 'gigs' then return jsonb_build_object('openGigs', true); end if;
  -- Story prices change what players pay, never the clout (which uses the base price).
  select * into pm from public.story_price(place -> 'tags', 'visit_price');
  v_paid := round(v_price * pm.multiplier);
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  -- At zero Energy players can't visit, attend or work; meals always work.
  if v_energy > 0 and me.energy < v_energy then raise exception 'no_energy' using errcode = '22023'; end if;
  if me.bank_cash < v_paid then raise exception 'cant_afford' using errcode = '22023'; end if;

  insert into public.place_visits (player_id, place_id, ny_date) values (uid, p_place, today)
  on conflict (player_id, place_id, ny_date) do update set visits = public.place_visits.visits + 1
  returning visits into n;
  first_today := n = 1;

  if first_today then
    -- Clout once a day per place, by base price; Mood/Confidence once a day per place.
    if v_kind in ('visit', 'eat') then
      v_clout := coalesce((a ->> 'clout')::int,
                          round(((e ->> 'baseVisitClout')::int + v_price * (e ->> 'cloutPerDollar')::numeric) * public.clout_multiplier(me.mood, me.confidence)));
    end if;
    v_mood := coalesce((a ->> 'mood')::int, 0);
    v_conf := coalesce((a ->> 'confidence')::int, 0);
  end if;

  update public.players
     set bank_cash = bank_cash - v_paid + v_pay,
         energy = least(100, greatest(0, energy - v_energy)),
         clout = clout + v_clout,
         mood = least(100, mood + v_mood),
         confidence = least(100, confidence + v_conf)
   where id = uid;
  if v_paid > 0 then perform public.ledger_once(uid, 'cash', -v_paid, v_kind, p_place || ':' || today || ':' || n); end if;
  if v_pay > 0 then perform public.ledger_once(uid, 'cash', v_pay, 'shift', p_place || ':' || today || ':' || n); end if;
  if v_clout > 0 then perform public.ledger_once(uid, 'clout', v_clout, 'visit', p_place || ':' || today); end if;

  task_cash := public.complete_task(uid, p_place, p_action);
  story_done := public.story_complete(uid, 'place', p_place, p_action);
  return jsonb_build_object('storyTasks', story_done, 'priceReason', pm.reason, 'cash', v_pay - v_paid + task_cash, 'clout', v_clout, 'energy', -v_energy, 'mood', v_mood,
                            'confidence', v_conf, 'firstToday', first_today, 'taskCash', task_cash);
end;
$$;

create or replace function public.attend_event(p_event text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ev jsonb;
  e jsonb := public.city() -> 'economy';
  v_cost int := (e -> 'energy' ->> 'eventCost')::int;
  today date := public.ny_today();
  mins int := public.city_minutes();
  start_m int;
  end_m int;
  v_open boolean;
  me public.players;
  v_clout int;
  task_cash int;
  v_entry int;
  av record;
begin
  select x into ev from jsonb_array_elements(public.city() -> 'events') x where x ->> 'id' = p_event;
  if ev is null then raise exception 'unknown_event' using errcode = '22023'; end if;
  start_m := (ev ->> 'startHour')::int * 60;
  end_m := mod(start_m + (ev ->> 'hours')::int * 60, 1440);
  v_open := case when start_m < end_m then mins >= start_m and mins < end_m else mins >= start_m or mins < end_m end;
  if not v_open then raise exception 'doors_closed' using errcode = '22023'; end if;
  select * into av from public.story_availability(
    (select p -> 'tags' from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = ev ->> 'placeId') || jsonb_build_array(p_event), null);
  if av.state = 'closed' then raise exception 'event_cancelled: %', av.reason using errcode = '22023'; end if;
  v_entry := round((ev ->> 'entry')::int * (select multiplier from public.story_price(
    (select p -> 'tags' from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = ev ->> 'placeId') || jsonb_build_array(p_event), 'event_entry')));

  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.energy < v_cost then raise exception 'no_energy' using errcode = '22023'; end if;
  if me.bank_cash < v_entry then raise exception 'cant_afford' using errcode = '22023'; end if;
  insert into public.event_attendance (player_id, event_id, ny_date) values (uid, p_event, today)
  on conflict do nothing;
  if not found then raise exception 'already_attended' using errcode = '22023'; end if;

  v_clout := round((ev ->> 'clout')::int * public.clout_multiplier(me.mood, me.confidence));
  update public.players
     set bank_cash = bank_cash - v_entry,
         energy = greatest(0, energy - v_cost),
         clout = clout + v_clout,
         mood = least(100, mood + (ev ->> 'mood')::int),
         confidence = least(100, confidence + (ev ->> 'confidence')::int)
   where id = uid;
  perform public.ledger_once(uid, 'cash', -v_entry, 'event_entry', p_event || ':' || today);
  perform public.ledger_once(uid, 'clout', v_clout, 'event', p_event || ':' || today);
  task_cash := public.complete_task(uid, ev ->> 'placeId', p_event);
  return jsonb_build_object('clout', v_clout, 'cash', -v_entry + task_cash, 'taskCash', task_cash);
end;
$$;

create or replace function public.buy_item(p_sku text, p_mode text default 'buy')
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  item jsonb := public.shop_item(p_sku);
  cat text := item ->> 'category';
  price int;
  e jsonb := public.city() -> 'economy';
  today date := public.ny_today();
  me public.players;
  v_clout int := 0;
  item_id bigint;
begin
  if item is null then raise exception 'unknown_item' using errcode = '22023'; end if;
  -- Story-only items (e.g. the "Forever Our Bird" hoodie) are sold only while a story opens them.
  if coalesce((item ->> 'storyOnly')::boolean, false) and (select state from public.story_availability(null, p_sku)) <> 'open' then
    raise exception 'unknown_item' using errcode = '22023';
  end if;
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if p_mode = 'rent' and (cat <> 'cars' or coalesce((item ->> 'rentPerWeek')::int, 0) = 0) then raise exception 'not_rentable' using errcode = '22023'; end if;
  if exists (select 1 from public.player_items where player_id = uid and sku = p_sku) then raise exception 'already_owned' using errcode = '22023'; end if;
  if cat = 'houses' and me.house_sku is not null then raise exception 'already_own_house' using errcode = '22023'; end if;
  if cat = 'cars' and me.car_mode = 'owned' then raise exception 'already_own_car' using errcode = '22023'; end if;
  if cat = 'cars' and p_mode = 'rent' and me.car_mode = 'rented' then raise exception 'already_renting' using errcode = '22023'; end if;

  price := case when p_mode = 'rent' then (item ->> 'rentPerWeek')::int else (item ->> 'price')::int end;
  price := round(price * (select multiplier from public.story_price(jsonb_build_array(p_sku, cat), 'shop_price')));
  if me.bank_cash < price then raise exception 'cant_afford' using errcode = '22023'; end if;

  -- Clout once per item ever (buying back after a sale pays none).
  if p_mode <> 'rent' then
    v_clout := round((item ->> 'clout')::int * power((e ->> 'purchaseCloutDecay')::numeric, me.purchases_count));
    if not public.ledger_once(uid, 'clout', v_clout, 'purchase', p_sku) then v_clout := 0; end if;
  end if;

  update public.players
     set bank_cash = bank_cash - price,
         clout = clout + v_clout,
         purchases_count = purchases_count + case when p_mode = 'rent' then 0 else 1 end,
         house_sku = case when cat = 'houses' then p_sku else house_sku end,
         next_rent_due = case when cat = 'houses' then null else next_rent_due end,
         car_sku = case when cat = 'cars' then p_sku else car_sku end,
         car_mode = case when cat = 'cars' then (case when p_mode = 'rent' then 'rented' else 'owned' end) else car_mode end,
         next_car_due = case when cat <> 'cars' then next_car_due
                             when p_mode = 'rent' then today + (e -> 'bills' ->> 'carRentalDays')::int
                             else (today + (e -> 'bills' ->> 'every')::interval)::date end
   where id = uid;
  if p_mode = 'rent' then
    perform public.ledger_once(uid, 'cash', -price, 'car_rental', p_sku || ':' || today);
  else
    insert into public.player_items (player_id, sku, category, value) values (uid, p_sku, cat, (item ->> 'price')::int)
    returning id into item_id;
    perform public.ledger_once(uid, 'cash', -price, 'purchase', item_id::text);
  end if;
  return jsonb_build_object('cash', -price, 'clout', v_clout);
end;
$$;

create or replace function public.ensure_daily(p_player uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  c jsonb := public.city();
  dt jsonb := c -> 'economy' -> 'dailyTasks';
  g jsonb := c -> 'economy' -> 'gigs';
  rate int := (c -> 'economy' ->> 'shiftRate')::int;
  shift_energy int := (c -> 'economy' ->> 'shiftEnergy')::int;
  cand record;
  v_slot int := 0;
  v_tier text;
  t jsonb;
  rolls int;
  titles jsonb;
begin
  if not exists (select 1 from public.daily_tasks where player_id = p_player and ny_date = today) then
    -- Every place action except the gigs board, plus each club event; only places that exist.
    for cand in
      select * from (
        select a ->> 'kind' as kind, p ->> 'id' as place_id, a ->> 'id' as action_id
          from jsonb_array_elements(c -> 'places') p, jsonb_array_elements(p -> 'actions') a
         where a ->> 'kind' <> 'gigs'
           -- Never a closed or restricted place, a story place or a story-unlock action, so no task is impossible.
           and p ->> 'story' is null
           and not coalesce((a ->> 'storyUnlock')::boolean, false)
           and (select state from public.story_availability(p -> 'tags', null)) not in ('closed', 'restricted')
        union all
        select 'event', e ->> 'placeId', e ->> 'id' from jsonb_array_elements(c -> 'events') e
         where (select state from public.story_availability(
                  (select p -> 'tags' from jsonb_array_elements(c -> 'places') p where p ->> 'id' = e ->> 'placeId') || jsonb_build_array(e ->> 'id'), null)) <> 'closed'
      ) all_actions
      order by random()
      limit (dt ->> 'count')::int
    loop
      v_slot := v_slot + 1;
      insert into public.daily_tasks (player_id, ny_date, slot, kind, place_id, action_id, reward)
      values (p_player, today, v_slot, cand.kind, cand.place_id, cand.action_id,
              5 * round(((dt ->> 'rewardMin')::int + random() * ((dt ->> 'rewardMax')::int - (dt ->> 'rewardMin')::int)) / 5));
    end loop;
  end if;

  if not exists (select 1 from public.gig_offers where player_id = p_player and ny_date = today) then
    foreach v_tier in array array['side', 'pro', 'big'] loop
      t := g -> v_tier;
      titles := c -> 'gigs' -> v_tier;
      rolls := case when v_tier = 'side' then 2 else 1 end;
      for i in 1..rolls loop
        if random() < (t ->> 'chance')::numeric then
          insert into public.gig_offers (player_id, ny_date, tier, title, pay, energy, wait_minutes, confidence_req)
          values (p_player, today, v_tier,
                  titles ->> floor(random() * jsonb_array_length(titles))::int,
                  10 * round(rate * ((t ->> 'payMin')::numeric + random() * ((t ->> 'payMax')::numeric - (t ->> 'payMin')::numeric)) / 10),
                  round(shift_energy * (t ->> 'energy')::numeric),
                  (t ->> 'waitMinutes')::int,
                  (t ->> 'confidence')::int);
        end if;
      end loop;
    end loop;
  end if;

  -- Story gigs injected by a beat today (task_injection "gigs"), under the normal gig rules.
  insert into public.gig_offers (player_id, ny_date, tier, title, pay, energy, wait_minutes, confidence_req, story_id)
  select p_player, today, sg ->> 'tier', sg ->> 'title',
         10 * round(rate * coalesce((sg ->> 'pay_multiple')::numeric, (g -> (sg ->> 'tier') ->> 'payMin')::numeric) / 10),
         round(shift_energy * coalesce((sg ->> 'energy_multiple')::numeric, (g -> (sg ->> 'tier') ->> 'energy')::numeric)),
         coalesce((sg ->> 'wait_minutes')::int, (g -> (sg ->> 'tier') ->> 'waitMinutes')::int),
         coalesce((sg ->> 'confidence')::int, (g -> (sg ->> 'tier') ->> 'confidence')::int),
         sg ->> 'id'
    from public.world_effects() w
   cross join lateral jsonb_array_elements(coalesce(w.effect -> 'gigs', '[]')) sg
   where w.effect ->> 'type' = 'task_injection'
     and not exists (select 1 from public.gig_offers o where o.player_id = p_player and o.ny_date = today and o.story_id = sg ->> 'id');
end;
$$;

-- ---------------------------------------------------------------------------
-- Story content (content/stories/*.json). Approved, not scheduled.
-- ---------------------------------------------------------------------------
insert into public.story_arcs (id, parent_id, type, tier, sku, status, review_status, start_at, data) values ('sarah-bird', null, 'main', 'free', null, 'active', 'approved', null, '{"id":"sarah-bird","title":"Who Killed Sarah Bird?","type":"main","tier":"free","status":"active","start_at":null,"start_weekday":"sunday","borough_scope":["queens"],"prompt":"Queens has a whodunit. Think you can crack it?","emoji":"🕊️","answer_key":{"killer":"pastor-vale","server_only":true},"badges":[{"id":"called-it","name":"Called It","emoji":"🎯","line":"You named the killer before Queens did."},{"id":"lolas-favorite","name":"Lola''s Favorite","emoji":"💋","line":"Three for three. Lola would like a word."},{"id":"armchair-detective","name":"Armchair Detective","emoji":"🕵️","line":"You solved it from the archive. Late, but right."}],"bonus_badge":{"badge":"lolas-favorite","requires":["P1","P2","P3"]},"shadow_badge":"armchair-detective","tasks":[{"id":"story:sarah-bird:leave-flowers","label":"Leave flowers at Skyline Pier","do":{"place":"skyline-pier","action":"lobby"},"clout":20},{"id":"story:sarah-bird:light-candle","label":"Light a candle at the vigil","do":{"event":"sb-vigil"},"clout":25},{"id":"story:sarah-bird:share-rumor","label":"Spill it: share the Theo rumor","do":{"share":"sb-3"},"clout":15},{"id":"story:sarah-bird:ask-ray","label":"Ask Ray what he saw","do":{"place":"skyline-pier","action":"lobby"},"clout":20},{"id":"story:sarah-bird:rewatch-story","label":"Rewatch Sarah''s last story","do":{"evidence":"sb-5"},"clout":10},{"id":"story:sarah-bird:visit-church","label":"Pay Radiant Harbor a visit","do":{"place":"radiant-harbor","action":"visit"},"clout":25}],"events":[{"id":"sb-vigil","name":"Candlelight vigil for Sarah","place":"hunters-pier","attendable":true,"energy":10,"clout":30,"mood":4,"blurb":"Hundreds of candles, one ring light and a lot of people who never met her crying anyway. Free to attend."},{"id":"harbor-dome-gala","name":"Harbor Dome groundbreaking gala","place":"radiant-harbor","attendable":false,"blurb":"Announced for next week, \"thanks to an anonymous gift.\" Invitation only, champagne optional, questions discouraged."}],"beats":[{"id":"sb-1","day":1,"status":"active","news":[{"headline":"Queens'' Glass Bird Goes Quiet","previously":null,"body":"Sarah Bird, 27, the voice behind \"Glass Bird\" and 7.5 million followers, was found unconscious in her Long Island City penthouse and pronounced dead this afternoon at 4:30 PM. She''d spent Sunday brunch with her mother, Loretta, and Pastor Gideon Vale, who brought his famous chamomile blessing tea, as always. Everyone is cooperating with police, darlings. Everyone.","hook":"Her phone still shows a livestream scheduled for tomorrow. Its title: \"The Big Announcement.\""}],"effects":[{"type":"availability","tags":["skyline_pier"],"state":"restricted","allow":["lobby"],"reason":"Police activity: lobby only","expires_day":9},{"type":"chatter_topic","topic":"sarah-bird","phase":"early","priority":2},{"type":"task_injection","add":["story:sarah-bird:leave-flowers"]}]},{"id":"sb-2","day":2,"status":"active","news":[{"headline":"Vigil, Vibes, and a Very Missing Boyfriend","previously":"Sarah Bird died after a Sunday brunch with her mom and her pastor.","body":"Hundreds packed Hunter''s Pier for a candlelight vigil led by Pastor Vale, co-trustee of Sarah''s charity, the Bird Song Foundation. Loretta livestreamed it with a ring light \"for the fans.\" Boyfriend Jett Calloway didn''t show, saying he was \"at the gym all afternoon\" on Sunday.","hook":"Pressed Iron Gym says Jett cancelled his membership two months ago."}],"effects":[{"type":"place_state","place":"hunters-pier","spawn_event":"sb-vigil","expires_day":3},{"type":"task_injection","add":["story:sarah-bird:light-candle"]}]},{"id":"sb-3","day":3,"status":"active","news":[{"headline":"Best Friend, Better Secret","previously":"Sarah''s boyfriend Jett skipped her vigil, and his gym alibi doesn''t exist.","body":"Photos surfaced of Sarah holding hands in a Rockaway Diner booth with Theo Marsh: Jett''s best friend and the co-writer of \"Glass Bird.\" A source says she ended it the night before she died, and Theo replied, \"You''ll regret this.\"","hook":"A service-door camera caught Theo entering her building at 2:15 PM on Sunday."}],"effects":[{"type":"place_state","place":"rockaway-diner","add_tags":["sarahs_booth"],"note":"Sarah''s booth"},{"type":"price_multiplier","tags":["rockaway_diner"],"applies_to":"visit_price","multiplier":1.5,"reason":"Fans are packing Sarah''s booth","expires_day":7},{"type":"task_injection","add":["story:sarah-bird:share-rumor"]}],"prediction":{"id":"P1","question":"Why was Theo at Sarah''s service door at 2:15 PM?","options":[{"id":"confront","label":"To confront her"},{"id":"apologize","label":"To apologize"},{"id":"meet-jett","label":"To meet Jett"},{"id":"take-back","label":"To take something back"}],"closes_at":{"day":4,"time":"23:59"},"reveal_beat":"sb-5","correct":"apologize","reward":{"clout":50},"changeable":true,"roasts":{"confront":"You picked confrontation. Theo brought white roses. Read the room, hon.","meet-jett":"You picked a bro meetup. Those two haven''t been bros since Tuesdays started.","take-back":"You picked a heist. The only thing he took was the long walk home."}}},{"id":"sb-4","day":4,"status":"active","news":[{"headline":"The Doorman''s Ledger","previously":"Sarah was secretly seeing Theo, Jett''s best friend, who was at her building the day she died.","body":"Doorman Ray keeps a paper sign-out book, and police have it. Loretta left at 12:10 PM and \"slammed the lobby door hard enough to wake Brooklyn.\" Pastor Vale signed out at 12:52 PM, though he told reporters he left \"right behind Loretta.\"","hook":"One more entry: Jett''s key fob opened the garage at 1:34 PM. So much for the gym."}],"effects":[{"type":"chatter_topic","topic":"sarah-bird","phase":"mid","priority":2},{"type":"task_injection","add":["story:sarah-bird:ask-ray"]}]},{"id":"sb-5","day":5,"status":"active","news":[{"headline":"Flowers at the Door","previously":"The doorman''s book puts Loretta, the pastor and Jett at Sarah''s building on Sunday.","body":"Police confirm Theo left white roses and a note at Sarah''s door: \"I''m sorry. I''ll wait as long as you need. T.\" He says he knocked at 2:15 PM and nobody answered. Fans also found Sarah''s last story, posted 12:31 PM: a teacup, a sun-logo thermos, and the caption \"one last cup before the big news.\"","hook":"If Sarah couldn''t answer the door at 2:15, what happened between 12:31 and 2:15?"}],"evidence":{"title":"Sarah''s last story, 12:31 PM","kind":"story-post","lines":["@sarahbird","A teacup on a marble counter. Behind it, a thermos with a little sun logo.","\"one last cup before the big news ☕✨\"","Posted 12:31 PM · 2.1M views"]},"effects":[{"type":"task_injection","add":["story:sarah-bird:rewatch-story"]}]},{"id":"sb-6","day":6,"status":"active","news":[{"headline":"Momager Math","previously":"Sarah stopped answering her door sometime between 12:31 PM and 2:15 PM on Sunday.","body":"A leaked contract shows Loretta earns 25% of everything Sarah makes, forever, and is beneficiary of a $3M life policy. Sarah had booked an entertainment lawyer for Monday to \"end a management agreement.\" Loretta also dropped a \"Forever Our Bird\" hoodie, $85, \"for healing.\"","hook":"A police inventory leak lists sleeping pills in Loretta''s handbag."}],"effects":[{"type":"availability","sku":"forever-our-bird-hoodie","state":"open","reason":"Limited drop: \"Forever Our Bird\"","expires_day":10}],"prediction":{"id":"P2","question":"Who killed Sarah Bird?","options":[{"id":"jett","label":"Jett"},{"id":"theo","label":"Theo"},{"id":"loretta","label":"Loretta"},{"id":"pastor-vale","label":"Pastor Vale"}],"closes_at":{"day":7,"time":"23:59"},"reveal_beat":"sb-9","correct":"pastor-vale","reward":{"clout":200,"badge":"called-it"},"changeable":true,"roasts":{"jett":"You picked Jett. So did most of Queens. The pastor thanks you for your support.","theo":"You picked Theo. He brought roses and an apology. Respectfully, no.","loretta":"You picked Loretta. Wrong drug, wrong motive, right vibes."}}},{"id":"sb-7","day":7,"status":"active","news":[{"headline":"The Tea, the Thermos, and the Gift","previously":"Loretta stood to lose a fortune if Sarah fired her, and police found sleeping pills in her bag.","body":"Toxicology: Sarah had a sedative in her system, carried in her tea, and it is not the drug Loretta is prescribed. The sun-logo thermos from her last story is nowhere in the apartment. Sarah''s accountant says she asked for a full audit of the Bird Song Foundation on the Friday before she died, and Pastor Vale just announced the Harbor Dome groundbreaking, \"thanks to an anonymous gift.\"","hook":"Jett''s lawyer, unprompted: \"My client took nothing from that apartment except what was his.\""}],"effects":[{"type":"place_state","place":"radiant-harbor","spawn_event":"harbor-dome-gala","expires_day":9},{"type":"task_injection","add":["story:sarah-bird:visit-church"]}],"prediction":{"id":"P3","question":"Where is the missing tea thermos?","options":[{"id":"jetts-car","label":"Jett''s car"},{"id":"lorettas-handbag","label":"Loretta''s handbag"},{"id":"radiant-harbor","label":"Radiant Harbor Church"},{"id":"east-river","label":"The East River"}],"closes_at":{"day":7,"time":"23:59"},"reveal_beat":"sb-9","correct":"radiant-harbor","reward":{"clout":75},"changeable":true,"roasts":{"jetts-car":"You picked Jett''s car. It''s full of sneaker boxes. Only sneaker boxes.","lorettas-handbag":"You picked the handbag. It held pills, a ring light and zero thermoses.","east-river":"You picked the East River. Dramatic. Wrong, but dramatic."}}},{"id":"sb-8","day":8,"status":"active","points_at_answer":true,"card_note":"Voting closed. The truth drops tomorrow.","news":[{"headline":"Case Closed? (Queens Thinks So)","previously":"The sedative was in Sarah''s tea, the thermos is missing, and Jett''s lawyer is nervous.","body":"Jett was brought in for questioning after bank records showed $40,000 moved from Sarah''s account to his resale business. Loretta posted \"JUSTICE\" in giant letters, and Pastor Vale prayed for Jett on Blessed & Booked. The comment section has closed the case.","hook":"Detective Nia Okafor skipped the press conference. She was spotted in Astoria, outside a church, holding a warrant and a photo of a thermos."}],"effects":[{"type":"chatter_topic","topic":"sarah-bird","phase":"late","priority":2}]},{"id":"sb-9","day":9,"status":"active","news":[{"headline":"The Pastor Is Not Available for Comment","previously":"The internet blamed Jett, but the detective went to Astoria.","body":"Pastor Gideon Vale was arrested at Radiant Harbor Church, where police found the sun-logo thermos washed and back on a shelf. The audit Sarah ordered shows $1.2M moved from her foundation to a company building the Harbor Dome. Elevator logs show Jett never left the garage level, and Vale was alone with Sarah for 42 minutes.","hook":"Police also recovered Sarah''s draft for \"The Big Announcement.\" Tomorrow, Queens finally hears it."}],"effects":[{"type":"availability","tags":["radiant_harbor"],"state":"closed","reason":"Closed: police activity","expires_day":10},{"type":"place_state","place":"radiant-harbor","cancel_event":"harbor-dome-gala","note":"Gala cancelled","expires_day":10},{"type":"flag","set":"sarah-bird-solved"}]},{"id":"sb-10","day":10,"status":"active","news":[{"headline":"The Big Announcement","previously":"Pastor Vale was arrested for Sarah''s death after police found the thermos at his church.","body":"Sarah''s draft was simple: she was leaving the church, handing her foundation to independent trustees, releasing her own album, and \"starting over with only the people who never asked me for anything.\" Theo gets his songwriting credit, Jett has to repay the $40K, and Loretta quietly pulled the hoodie. Rest easy, Glass Bird.","hook":"Lola''s sign-off: \"Ray the doorman says someone new just moved into the penthouse. And Loretta is already asking for their number.\""}],"effects":[{"type":"place_state","place":"skyline-pier","unlock_action":"memorial","note":"Memorial wall"},{"type":"chatter_topic","topic":"sarah-bird","phase":"post","priority":2}]}],"chatter":{"sarah-bird":{"early":{"bartender":["Third \"Glass Bird\" request tonight. I''m not crying, the limes are strong.","Somebody tipped me a candle emoji. Just the emoji. On a receipt.","Her song came on and the whole bar went quiet. Even the guy who never goes quiet."],"barista":["Her mom ordered a large and asked if it came with a ring light.","Everybody''s ordering whatever Sarah ordered. Nobody knows what Sarah ordered.","We put her song on the playlist. The espresso machine is the only one not crying."],"doorman":["Ray''s been writing in that little book for twenty years. Finally matters.","Cops asked me who comes and goes. I said everybody, officer. This is Queens."],"driver":["Dropped a guy at the vigil wearing her face on a hoodie. The mom''s hoodie.","Three fares today just wanted to drive past her building. Slowly. With the windows down."],"clerk":["The cat''s been sitting by the radio every time they play her song. The cat knows things.","People keep buying white roses at 2 AM. We don''t even sell roses. They keep asking."]},"mid":{"bartender":["Forty-two minutes, that doorman says. What takes forty-two minutes after brunch?","Half the bar says Jett, half says the mom. The other half can''t count."],"barista":["I''m not saying it was the tea. I''m saying nobody''s ordered chamomile in three days.","A guy asked if our oat milk was \"police-approved.\" Sir, this is a café."],"doorman":["Jett parked in her spot like he paid the rent. He didn''t.","Every doorman in Queens just bought a little notebook. Ray''s a legend now."],"driver":["Took Theo to Rockaway once. Played her song four times, then asked me to stop.","Lady in the back asked me to drive past the diner booth. I said ma''am, it''s a booth."],"clerk":["Everyone''s a detective now. Nobody''s a customer.","Guy bought a chopped cheese and explained the whole timeline. I just wanted the exact change."]},"late":{"bartender":["Everyone in here says Jett. Everyone in here also said the Comets would make the playoffs.","The comment section closed the case. The comment section also thinks the moon is a hologram."],"barista":["Detective came in, ordered nothing, asked about thermoses. Rude, but intriguing.","Somebody saw a cop in Astoria with a picture of a thermos. A thermos. Think about it."],"doorman":["The pastor tipped Ray a hundred once. Never before, never since.","Ray hasn''t put that little book down all week. He sleeps with it, probably."],"driver":["Drove a cop to Astoria this morning. Church district. Make of that what you will.","Everybody''s saying it''s over. The detective didn''t look like it was over."],"clerk":["Funny how nobody''s talking about the church. Funny how that works.","The cat stopped sitting by the radio. The cat thinks it''s not who you think."]},"post":{"bartender":["First round''s on the house. To the Bird.","Her album''s coming out after all. I''m putting it on repeat and you can''t stop me."],"barista":["We''re calling the new latte \"The Big Announcement.\" Too soon?","Chamomile''s back on the menu. Nobody''s ordering it. Respect."],"doorman":["New tenant upstairs. Nice. Doesn''t drink tea.","Ray''s book is going in a museum, probably. He says it''s going in a drawer."],"driver":["Everyone''s asking for the church route now. It''s closed, people.","Drove Theo to the memorial wall. He sat there an hour. Didn''t charge him the wait."],"clerk":["The cat''s back by the radio. They''re playing her song again.","People still bring white roses. We still don''t sell them. Now we kind of want to."]}}}}'::jsonb);
insert into public.story_arcs (id, parent_id, type, tier, sku, status, review_status, start_at, data) values ('sarah-bird-momager-files', 'sarah-bird', 'side', 'premium', 'side_sarah_bird_momager_files', 'active', 'approved', null, '{"id":"sarah-bird-momager-files","title":"The Momager Files","type":"side","kind":"evidence","parent_arc_id":"sarah-bird","tier":"premium","sku":"side_sarah_bird_momager_files","status":"active","teaser":"Loretta kept every receipt. Every single one.","emoji":"🗂️","beats":[{"id":"mf-1","day":1,"status":"active","effects":[],"news":[{"headline":"Contract, Page 14","body":"The management deal: 25% forever, including Sarah''s \"likeness after death.\" Loretta drafted it herself, on Sarah''s 16th birthday.","hook":"A sticky note on page 14: \"She''ll never read this far.\""}]},{"id":"mf-2","day":3,"status":"active","effects":[],"news":[{"headline":"Voice Note, Saturday, 11:48 PM","body":"Loretta to her sister, the night before brunch, slightly breathless: \"Tomorrow I''m finally getting what I''m owed.\"","hook":"Owed what, and by whom?"}]},{"id":"mf-3","day":5,"status":"active","effects":[],"news":[{"headline":"The Policy","body":"The $3M life policy, with premiums paid from Sarah''s account, was raised by Loretta this summer. Last month Sarah filled in a beneficiary change form.","hook":"She never signed it."}]},{"id":"mf-4","day":7,"status":"active","effects":[],"news":[{"headline":"The Receipts Folder","body":"\"What I''m owed\" was $60K Loretta spent on Sarah''s first demo and first lease when Sarah was 17, and she kept every receipt. Sarah''s statements also show $30K a month to Loretta, plus Jett''s \"loans.\"","hook":"The last receipt is a florist order for white roses, placed Sunday at 11:02 AM."}]},{"id":"mf-5","day":9,"status":"active","effects":[],"news":[{"headline":"What Loretta Kept","body":"The roses were a brunch peace offering with a card, \"I''m sorry too. Mom,\" never delivered because she stormed out. Sarah had drafted a reply promising her mother 10% for life. One more line in Sarah''s statements: a $25K monthly \"tithe\" to Radiant Harbor, which stopped the day she ordered the audit.","hook":"Loretta reads the draft and asks if it''s legally binding."}]}]}'::jsonb);
insert into public.story_arcs (id, parent_id, type, tier, sku, status, review_status, start_at, data) values ('sarah-bird-night-book', 'sarah-bird', 'side', 'premium', 'side_sarah_bird_night_book', 'active', 'approved', null, '{"id":"sarah-bird-night-book","title":"Ray''s Night Book","type":"side","kind":"insider","parent_arc_id":"sarah-bird","tier":"premium","sku":"side_sarah_bird_night_book","status":"active","teaser":"Twenty years at the front desk. One tenant asked him to write everything down.","emoji":"📒","beats":[{"id":"nb-1","day":1,"status":"active","effects":[],"news":[{"headline":"Twenty Years, One Book","body":"Ray''s rules for doormen, and why Sarah was the only tenant who knew his kids'' names. Last month, she asked him to log every visitor.","hook":"\"Everyone, Ray. Even the ones I love.\""}]},{"id":"nb-2","day":3,"status":"active","effects":[],"news":[{"headline":"Tuesdays, Service Door","body":"Theo came every Tuesday through the service door, and Ray covered for them. Jett once offered Ray $500 for the Tuesday log. Ray refused.","hook":"The next Tuesday, the service camera was \"broken.\""}]},{"id":"nb-3","day":5,"status":"active","effects":[],"news":[{"headline":"Loretta''s Spare Key","body":"Loretta came alone twice last month, late at night, and left with a box of papers. Ray wrote down the time both times.","hook":"Ray saw the top folder''s label: \"BENEFICIARY.\""}]},{"id":"nb-4","day":7,"status":"active","effects":[],"news":[{"headline":"The Man in the Gray Suit","body":"A week before she died, a man in a gray suit with a briefcase visited Sarah for an hour. The Sunday regulars are logged as usual: Loretta at 11, Pastor V. at 11 sharp.","hook":"\"I told the police everything. Except one thing.\""}]},{"id":"nb-5","day":9,"status":"active","effects":[],"news":[{"headline":"The One Thing","body":"Ray never told police he''d let Theo in on Sunday, which is why Theo looked so guilty. The man in the gray suit was her accountant, and after he left, Sarah sat in the lobby and cried, the first time Ray had ever seen it.","hook":"Sarah had told him: \"If anything happens, give the book to someone who doesn''t come to Sunday brunch.\" Tonight''s new entry: the penthouse has a new tenant."}]}]}'::jsonb);
insert into public.story_arcs (id, parent_id, type, tier, sku, status, review_status, start_at, data) values ('sarah-bird-plus-one', 'sarah-bird', 'side', 'premium', 'side_sarah_bird_plus_one', 'active', 'approved', null, '{"id":"sarah-bird-plus-one","title":"Jett: The Plus-One","type":"side","kind":"perspective","parent_arc_id":"sarah-bird","tier":"premium","sku":"side_sarah_bird_plus_one","status":"active","teaser":"He was in every photo. He was never in the caption.","emoji":"👟","beats":[{"id":"po-1","day":1,"status":"active","effects":[],"news":[{"headline":"Always the Accessory","body":"Jett on life as the blur behind her selfies, and on Loretta''s nickname for him: \"the accessory.\" He swears he was building something. Then he admits he''d bought an engagement ring.","hook":"He paid for it with Sarah''s card."}]},{"id":"po-2","day":3,"status":"active","effects":[],"news":[{"headline":"I Knew About Theo","body":"Jett knew about the affair for three weeks and said nothing, because Theo had lent him $15K. Best friends, worse bookkeeping.","hook":"His unsent Saturday-night text to Theo: \"After tomorrow we settle everything.\""}]},{"id":"po-3","day":5,"status":"active","effects":[],"news":[{"headline":"The $40K","body":"Jett calls the transfers \"loans\" for a sneaker drop. Sarah found out the Thursday before she died and told him, \"I''m not mad. I''m done.\"","hook":"She let him keep the money. So why did he go to her garage on Sunday?"}]},{"id":"po-4","day":7,"status":"active","effects":[],"news":[{"headline":"Twenty Minutes in the Garage","body":"He went to grab $40K of sneakers from his car before she could claim them, then sat in the garage for twenty minutes deciding whether to go up and propose anyway.","hook":"His phone rings. It''s Detective Okafor."}]},{"id":"po-5","day":9,"status":"active","effects":[],"news":[{"headline":"The Speech I Didn''t Give","body":"His proposal speech, read aloud. He admits he loved the life more than he loved her. The proposal, it turns out, was Loretta''s idea.","hook":"He gives Loretta the ring to return. She doesn''t."}]}]}'::jsonb);

-- ---------------------------------------------------------------------------
-- Grants: players call the feed and story actions; everything that sees
-- answers or pays rewards stays server-internal.
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.story_feed()', 'public.vote_prediction(text, text)', 'public.shadow_guess(text, text)', 'public.mark_beat_seen(text)',
    'public.complete_story_task(text)', 'public.attend_story_event(text)', 'public.is_story_admin()',
    'public.admin_story_upsert(jsonb)', 'public.admin_story_review(text, text, text)', 'public.admin_story_schedule(text, date)',
    'public.admin_story_status(text, text)', 'public.admin_beat_status(text, text, text)', 'public.admin_story_list()', 'public.admin_story_get(text)',
    'public.dev_story_start(text, date)', 'public.dev_grant_entitlement(text, boolean)', 'public.story_debug()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'public.arc_start(public.story_arcs)', 'public.arc_day(public.story_arcs)', 'public.arc_last_day(public.story_arcs)',
    'public.story_time(date, int, text)', 'public.arc_started(text)', 'public.has_entitlement(uuid, text)', 'public.world_effects()',
    'public.story_price(jsonb, text)', 'public.story_availability(jsonb, text)', 'public.story_flag(text)', 'public.story_unlocked(text, text)',
    'public.story_event(text)', 'public.story_tasks_today()', 'public.story_complete(uuid, text, text, text)', 'public.story_predictions()',
    'public.claim_story_rewards(uuid)', 'public.require_story_admin()', 'public.require_dev_tools()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
