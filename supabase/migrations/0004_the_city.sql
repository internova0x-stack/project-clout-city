-- Clout City v0.3 "The City": the New York calendar, places and their actions,
-- dining and Energy, job shifts, gigs, club events, daily tasks, the Shop,
-- Possessions and selling, bills and missed rent, plus a staging clock offset
-- for time-travel testing. Adds to earlier tables; nothing is rebuilt.
--
-- Two clocks (Clarifications section 12): anything that pays out or resets
-- follows the New York calendar (ny_today()); club event hours follow the fast
-- city clock (city_minutes()). Daily effects are applied lazily by tick() on the
-- player's next action, so no scheduled job is needed.

-- ---------------------------------------------------------------------------
-- Content and dev settings. The 'city' seed is generated from lib/city.ts by
-- scripts/gen-city-seed.ts; tests/city.test.ts checks they still match.
-- ---------------------------------------------------------------------------
insert into public.game_settings (key, value) values
('city', '{"economy":{"shiftRate":120,"cloutPerDollar":0.6,"baseVisitClout":5,"cloutMultiplier":{"base":0.7,"mood":0.3,"confidence":0.3},"energy":{"dailyTopUp":20,"eventCost":20},"confidenceDriftPerDay":3,"dailyTasks":{"count":5,"rewardMin":40,"rewardMax":90,"bonus":150},"sellRate":0.6,"purchaseCloutDecay":0.85,"bills":{"periodDays":7,"phone":85,"graceDays":3,"moodDropPerDay":8,"evictAfterDays":7,"carInsuranceRate":0.02},"gigs":{"side":{"confidence":0,"chance":0.9,"payMin":2,"payMax":3,"energy":1.5,"waitMinutes":60},"pro":{"confidence":50,"chance":0.5,"payMin":4,"payMax":6,"energy":2,"waitMinutes":120},"big":{"confidence":80,"chance":0.22,"payMin":10,"payMax":15,"energy":3,"waitMinutes":240}},"shiftEnergy":25},"places":[{"id":"velvet-static","actions":[{"id":"visit","kind":"visit","price":60,"pay":0,"energy":15,"mood":6,"confidence":4}]},{"id":"grind-and-gossip","actions":[{"id":"eat","kind":"eat","price":18,"pay":0,"energy":-30,"mood":0,"confidence":0},{"id":"shift","kind":"shift","price":0,"pay":120,"energy":25,"mood":0,"confidence":0}]},{"id":"lucky-seven-deli","actions":[{"id":"eat","kind":"eat","price":7,"pay":0,"energy":-15,"mood":0,"confidence":0}]},{"id":"altitude-718","actions":[{"id":"eat","kind":"eat","price":95,"pay":0,"energy":-55,"mood":0,"confidence":0}]},{"id":"flushing-meadows","actions":[{"id":"hangout","kind":"hangout","price":0,"pay":0,"energy":5,"mood":12,"confidence":0}]},{"id":"pedal-pushers","actions":[{"id":"shift","kind":"shift","price":0,"pay":135,"energy":30,"mood":0,"confidence":0}]},{"id":"skybridge-tower","actions":[{"id":"gigs","kind":"gigs","price":0,"pay":0,"energy":0,"mood":0,"confidence":0}]}],"events":[{"id":"neon-nights","placeId":"velvet-static","startHour":22,"hours":5,"entry":80,"clout":60,"confidence":8,"mood":6},{"id":"golden-hour","placeId":"velvet-static","startHour":15,"hours":4,"entry":50,"clout":40,"confidence":6,"mood":8}],"gigs":{"side":["Be a professional crowd at a gallery opening","Stand in line for a sneaker drop","Laugh on cue at a comedy open mic","Hold a ring light at a rooftop shoot"],"pro":["Run a launch campaign for a $14 artisanal ice cube startup","Ghost-write a podcast host''s \"authentic\" origin story","Manage socials for a dog with 40k followers"],"big":["Write a speech for a councilmember candidate","Art-direct a perfume ad for a fictional heiress"]},"shop":[{"sku":"fit-satin-bomber","category":"fashion","price":180,"clout":25,"rentPerWeek":0,"slot":"top"},{"sku":"fit-leather-blazer","category":"fashion","price":420,"clout":45,"rentPerWeek":0,"slot":"top"},{"sku":"fit-varsity-tee","category":"fashion","price":65,"clout":10,"rentPerWeek":0,"slot":"top"},{"sku":"fit-wide-trousers","category":"fashion","price":140,"clout":18,"rentPerWeek":0,"slot":"bottom"},{"sku":"fit-mini-skirt","category":"fashion","price":120,"clout":16,"rentPerWeek":0,"slot":"bottom"},{"sku":"fit-chunky-sneakers","category":"fashion","price":210,"clout":28,"rentPerWeek":0,"slot":"shoes"},{"sku":"fit-bucket-hat","category":"fashion","price":55,"clout":8,"rentPerWeek":0,"slot":"accessory"},{"sku":"car-hatchback","category":"cars","price":14000,"clout":120,"rentPerWeek":350,"slot":null},{"sku":"car-luxury-sedan","category":"cars","price":52000,"clout":300,"rentPerWeek":900,"slot":null},{"sku":"car-electric-coupe","category":"cars","price":78000,"clout":420,"rentPerWeek":1300,"slot":null},{"sku":"house-astoria-townhouse","category":"houses","price":180000,"clout":900,"rentPerWeek":0,"slot":null},{"sku":"house-lic-penthouse","category":"houses","price":650000,"clout":2400,"rentPerWeek":0,"slot":null},{"sku":"lux-gold-chain","category":"luxury","price":900,"clout":70,"rentPerWeek":0,"slot":null},{"sku":"lux-diamond-studs","category":"luxury","price":2400,"clout":140,"rentPerWeek":0,"slot":null},{"sku":"lux-designer-watch","category":"luxury","price":6800,"clout":260,"rentPerWeek":0,"slot":null},{"sku":"mu-glow-kit","category":"makeup","price":75,"clout":12,"rentPerWeek":0,"slot":null},{"sku":"mu-lip-set","category":"makeup","price":95,"clout":14,"rentPerWeek":0,"slot":null},{"sku":"mu-lash-bar","category":"makeup","price":160,"clout":20,"rentPerWeek":0,"slot":null}],"homeLocations":{"astoria_studio":[40.7745,-73.905],"jackson_heights_1br":[40.752,-73.883],"lic_highrise":[40.747,-73.956]}}'::jsonb),
-- Staging only: set "tools" to true to allow the time-travel control. Never in production.
('dev', '{"tools": false, "clockOffsetSeconds": 0}'::jsonb);

create function public.city() returns jsonb
language sql stable security definer set search_path = public
as $$ select value from public.game_settings where key = 'city' $$;

-- ---------------------------------------------------------------------------
-- Clocks
-- ---------------------------------------------------------------------------
create function public.game_now() returns timestamptz
language sql stable security definer set search_path = public
as $$
  select now() + make_interval(secs => coalesce((select (value ->> 'clockOffsetSeconds')::double precision
                                                  from public.game_settings where key = 'dev'), 0))
$$;

create function public.ny_today() returns date
language sql stable security definer set search_path = public
as $$ select (public.game_now() at time zone 'America/New_York')::date $$;

-- Minutes since city-clock midnight: one city day every 2 real hours (lib/cityClock.ts).
create function public.city_minutes() returns int
language sql stable security definer set search_path = public
as $$ select floor(mod((extract(epoch from public.game_now()) * 1000)::numeric, 7200000) / 7200000 * 1440)::int $$;

-- ---------------------------------------------------------------------------
-- Player columns
-- ---------------------------------------------------------------------------
alter table public.players
  add column last_tick_date       date,
  add column next_rent_due        date,
  add column next_phone_due       date,
  add column next_car_due         date,
  add column mood_penalty_through date,
  add column house_sku            text,
  add column car_sku              text,
  add column car_mode             text check (car_mode in ('owned', 'rented')),
  add column purchases_count      integer not null default 0;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.place_visits (
  player_id uuid not null references public.players (id) on delete cascade,
  place_id  text not null,
  ny_date   date not null,
  visits    integer not null default 1,
  primary key (player_id, place_id, ny_date)
);

create table public.daily_tasks (
  id         bigint generated always as identity primary key,
  player_id  uuid not null references public.players (id) on delete cascade,
  ny_date    date not null,
  slot       smallint not null,
  kind       text not null,
  place_id   text not null,
  action_id  text not null,
  reward     integer not null,
  done_at    timestamptz,
  unique (player_id, ny_date, slot)
);

create table public.gig_offers (
  id            bigint generated always as identity primary key,
  player_id     uuid not null references public.players (id) on delete cascade,
  ny_date       date not null,
  tier          text not null check (tier in ('side', 'pro', 'big')),
  title         text not null,
  pay           integer not null,
  energy        integer not null,
  wait_minutes  integer not null,
  confidence_req integer not null,
  accepted_at   timestamptz,
  ready_at      timestamptz,
  collected_at  timestamptz
);
create index gig_offers_player_idx on public.gig_offers (player_id, ny_date);

create table public.event_attendance (
  player_id uuid not null references public.players (id) on delete cascade,
  event_id  text not null,
  ny_date   date not null,
  primary key (player_id, event_id, ny_date)
);

create table public.bills (
  id         bigint generated always as identity primary key,
  player_id  uuid not null references public.players (id) on delete cascade,
  kind       text not null check (kind in ('rent', 'phone', 'car_rental', 'car_insurance')),
  amount     integer not null,
  due_date   date not null,
  status     text not null default 'due' check (status in ('due', 'paid', 'forgiven')),
  paid_at    timestamptz,
  created_at timestamptz not null default now()
);
create index bills_player_idx on public.bills (player_id, status, due_date);

create table public.player_items (
  id         bigint generated always as identity primary key,
  player_id  uuid not null references public.players (id) on delete cascade,
  sku        text not null,
  category   text not null,
  value      bigint not null,
  acquired   text not null default 'bought' check (acquired in ('bought', 'earned')),
  equipped   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (player_id, sku)
);

alter table public.place_visits enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.gig_offers enable row level security;
alter table public.event_attendance enable row level security;
alter table public.bills enable row level security;
alter table public.player_items enable row level security;

create policy "own visits" on public.place_visits for select to authenticated using (player_id = auth.uid());
create policy "own tasks" on public.daily_tasks for select to authenticated using (player_id = auth.uid());
create policy "own gigs" on public.gig_offers for select to authenticated using (player_id = auth.uid());
create policy "own attendance" on public.event_attendance for select to authenticated using (player_id = auth.uid());
create policy "own bills" on public.bills for select to authenticated using (player_id = auth.uid());
create policy "own items" on public.player_items for select to authenticated using (player_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.clout_multiplier(p_mood int, p_confidence int) returns numeric
language sql stable security definer set search_path = public
as $$
  select (m ->> 'base')::numeric + (m ->> 'mood')::numeric * p_mood / 100 + (m ->> 'confidence')::numeric * p_confidence / 100
    from (select public.city() -> 'economy' -> 'cloutMultiplier' as m) c
$$;

create function public.rent_for(p_home text) returns int
language sql stable security definer set search_path = public
as $$ select (h ->> 'rent')::int from jsonb_array_elements(public.economy() -> 'homes') h where h ->> 'id' = p_home $$;

create function public.cheapest_home() returns text
language sql stable security definer set search_path = public
as $$ select h ->> 'id' from jsonb_array_elements(public.economy() -> 'homes') h order by (h ->> 'rent')::int limit 1 $$;

create function public.shop_item(p_sku text) returns jsonb
language sql stable security definer set search_path = public
as $$ select i from jsonb_array_elements(public.city() -> 'shop') i where i ->> 'sku' = p_sku $$;

create function public.place_action(p_place text, p_action text) returns jsonb
language sql stable security definer set search_path = public
as $$
  select a from jsonb_array_elements(public.city() -> 'places') p, jsonb_array_elements(p -> 'actions') a
   where p ->> 'id' = p_place and a ->> 'id' = p_action
$$;

-- Pays the daily task matching an action, and the bonus once all are done.
create function public.complete_task(p_player uuid, p_place text, p_action text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  today date := public.ny_today();
  t record;
  bonus int := (public.city() -> 'economy' -> 'dailyTasks' ->> 'bonus')::int;
  paid int := 0;
begin
  select * into t from public.daily_tasks
   where player_id = p_player and ny_date = today and place_id = p_place and action_id = p_action and done_at is null
   order by slot limit 1 for update;
  if t.id is null then return 0; end if;
  update public.daily_tasks set done_at = now() where id = t.id;
  if public.ledger_once(p_player, 'cash', t.reward, 'daily_task', t.id::text) then
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

-- Today's five tasks and gig offers, generated once per player per New York day.
create function public.ensure_daily(p_player uuid)
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
        union all
        select 'event', e ->> 'placeId', e ->> 'id' from jsonb_array_elements(c -> 'events') e
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
end;
$$;

-- Applies everything that happened since the player's last action: the daily
-- Energy top-up and Confidence drift, bills coming due, missed-rent penalties,
-- and today's tasks and gig offers. Bills and rent are protected from stories.
create function public.tick(p_player uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  c jsonb := public.city() -> 'economy';
  b jsonb := c -> 'bills';
  period int := (b ->> 'periodDays')::int;
  today date := public.ny_today();
  me public.players;
  days int;
  overdue record;
  penalty_from date;
  car jsonb;
begin
  select * into me from public.players where id = p_player for update;
  if me.id is null or me.home_id is null then return; end if;

  if me.last_tick_date is null then
    -- First tick after moving in: start the weekly bills from the move-in day.
    update public.players
       set last_tick_date = today,
           next_rent_due = coalesce(next_rent_due, (coalesce(moved_in_at, now()) at time zone 'America/New_York')::date + period),
           next_phone_due = coalesce(next_phone_due, (coalesce(moved_in_at, now()) at time zone 'America/New_York')::date + period)
     where id = p_player
     returning * into me;
  end if;

  days := today - me.last_tick_date;
  if days > 0 then
    update public.players
       set energy = least(100, energy + (c -> 'energy' ->> 'dailyTopUp')::int * days),
           confidence = greatest(0, confidence - (c ->> 'confidenceDriftPerDay')::int * days),
           last_tick_date = today
     where id = p_player
     returning * into me;
  end if;

  -- Bills coming due (weekly).
  while me.house_sku is null and me.next_rent_due is not null and me.next_rent_due <= today loop
    insert into public.bills (player_id, kind, amount, due_date) values (p_player, 'rent', public.rent_for(me.home_id), me.next_rent_due);
    me.next_rent_due := me.next_rent_due + period;
  end loop;
  while me.next_phone_due is not null and me.next_phone_due <= today loop
    insert into public.bills (player_id, kind, amount, due_date) values (p_player, 'phone', (b ->> 'phone')::int, me.next_phone_due);
    me.next_phone_due := me.next_phone_due + period;
  end loop;
  if me.car_sku is not null then
    car := public.shop_item(me.car_sku);
    while me.next_car_due is not null and me.next_car_due <= today loop
      if me.car_mode = 'rented' then
        insert into public.bills (player_id, kind, amount, due_date) values (p_player, 'car_rental', (car ->> 'rentPerWeek')::int, me.next_car_due);
      else
        insert into public.bills (player_id, kind, amount, due_date)
        values (p_player, 'car_insurance', ceil((car ->> 'price')::int * (b ->> 'carInsuranceRate')::numeric), me.next_car_due);
      end if;
      me.next_car_due := me.next_car_due + period;
    end loop;
  end if;
  update public.players set next_rent_due = me.next_rent_due, next_phone_due = me.next_phone_due, next_car_due = me.next_car_due where id = p_player;

  -- Missed rent: a grace period, then Mood drops each day, then a move to the cheapest home.
  select * into overdue from public.bills
   where player_id = p_player and kind = 'rent' and status = 'due' order by due_date limit 1;
  if overdue.id is not null then
    if today - overdue.due_date >= (b ->> 'evictAfterDays')::int then
      update public.bills set status = 'forgiven' where player_id = p_player and kind = 'rent' and status = 'due';
      update public.players
         set home_id = public.cheapest_home(), next_rent_due = today, mood_penalty_through = today
       where id = p_player;
      insert into public.bills (player_id, kind, amount, due_date) values (p_player, 'rent', public.rent_for(public.cheapest_home()), today);
      update public.players set next_rent_due = today + period where id = p_player;
    elsif today - overdue.due_date > (b ->> 'graceDays')::int then
      penalty_from := greatest(coalesce(me.mood_penalty_through, overdue.due_date + (b ->> 'graceDays')::int),
                               overdue.due_date + (b ->> 'graceDays')::int);
      if today > penalty_from then
        update public.players
           set mood = greatest(0, mood - (b ->> 'moodDropPerDay')::int * (today - penalty_from)),
               mood_penalty_through = today
         where id = p_player;
      end if;
    end if;
  end if;

  perform public.ensure_daily(p_player);
end;
$$;

-- ---------------------------------------------------------------------------
-- Player-facing functions
-- ---------------------------------------------------------------------------
create function public.sync_player()
returns public.players
language plpgsql security definer set search_path = public
as $$
declare me public.players;
begin
  perform public.tick(auth.uid());
  select * into me from public.players where id = auth.uid();
  return me;
end;
$$;

-- One action at a place: visit, eat, work a shift or hang out (Clarifications sections 4 and 13).
create function public.do_action(p_place text, p_action text)
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
begin
  if a is null then raise exception 'unknown_action' using errcode = '22023'; end if;
  if v_kind = 'gigs' then return jsonb_build_object('openGigs', true); end if;
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  -- At zero Energy players can't visit, attend or work; meals always work.
  if v_energy > 0 and me.energy < v_energy then raise exception 'no_energy' using errcode = '22023'; end if;
  if me.bank_cash < v_price then raise exception 'cant_afford' using errcode = '22023'; end if;

  insert into public.place_visits (player_id, place_id, ny_date) values (uid, p_place, today)
  on conflict (player_id, place_id, ny_date) do update set visits = public.place_visits.visits + 1
  returning visits into n;
  first_today := n = 1;

  if first_today then
    -- Clout once a day per place, by base price; Mood/Confidence once a day per place.
    if v_kind in ('visit', 'eat') then
      v_clout := round(((e ->> 'baseVisitClout')::int + v_price * (e ->> 'cloutPerDollar')::numeric) * public.clout_multiplier(me.mood, me.confidence));
    end if;
    v_mood := coalesce((a ->> 'mood')::int, 0);
    v_conf := coalesce((a ->> 'confidence')::int, 0);
  end if;

  update public.players
     set bank_cash = bank_cash - v_price + v_pay,
         energy = least(100, greatest(0, energy - v_energy)),
         clout = clout + v_clout,
         mood = least(100, mood + v_mood),
         confidence = least(100, confidence + v_conf)
   where id = uid;
  if v_price > 0 then perform public.ledger_once(uid, 'cash', -v_price, v_kind, p_place || ':' || today || ':' || n); end if;
  if v_pay > 0 then perform public.ledger_once(uid, 'cash', v_pay, 'shift', p_place || ':' || today || ':' || n); end if;
  if v_clout > 0 then perform public.ledger_once(uid, 'clout', v_clout, 'visit', p_place || ':' || today); end if;

  task_cash := public.complete_task(uid, p_place, p_action);
  return jsonb_build_object('cash', v_pay - v_price + task_cash, 'clout', v_clout, 'energy', -v_energy, 'mood', v_mood,
                            'confidence', v_conf, 'firstToday', first_today, 'taskCash', task_cash);
end;
$$;

-- Club events (virtual cash): doors follow the city clock; clout once a New York day per event.
create function public.attend_event(p_event text)
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
begin
  select x into ev from jsonb_array_elements(public.city() -> 'events') x where x ->> 'id' = p_event;
  if ev is null then raise exception 'unknown_event' using errcode = '22023'; end if;
  start_m := (ev ->> 'startHour')::int * 60;
  end_m := mod(start_m + (ev ->> 'hours')::int * 60, 1440);
  v_open := case when start_m < end_m then mins >= start_m and mins < end_m else mins >= start_m or mins < end_m end;
  if not v_open then raise exception 'doors_closed' using errcode = '22023'; end if;

  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.energy < v_cost then raise exception 'no_energy' using errcode = '22023'; end if;
  if me.bank_cash < (ev ->> 'entry')::int then raise exception 'cant_afford' using errcode = '22023'; end if;
  insert into public.event_attendance (player_id, event_id, ny_date) values (uid, p_event, today)
  on conflict do nothing;
  if not found then raise exception 'already_attended' using errcode = '22023'; end if;

  v_clout := round((ev ->> 'clout')::int * public.clout_multiplier(me.mood, me.confidence));
  update public.players
     set bank_cash = bank_cash - (ev ->> 'entry')::int,
         energy = greatest(0, energy - v_cost),
         clout = clout + v_clout,
         mood = least(100, mood + (ev ->> 'mood')::int),
         confidence = least(100, confidence + (ev ->> 'confidence')::int)
   where id = uid;
  perform public.ledger_once(uid, 'cash', -(ev ->> 'entry')::int, 'event_entry', p_event || ':' || today);
  perform public.ledger_once(uid, 'clout', v_clout, 'event', p_event || ':' || today);
  task_cash := public.complete_task(uid, ev ->> 'placeId', p_event);
  return jsonb_build_object('clout', v_clout, 'cash', -(ev ->> 'entry')::int + task_cash, 'taskCash', task_cash);
end;
$$;

-- Gigs (Clarifications section 13): one at a time, Energy up front, cash after the wait. No clout.
create function public.accept_gig(p_offer bigint)
returns public.gig_offers
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  o public.gig_offers;
  me public.players;
begin
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  select * into o from public.gig_offers where id = p_offer and player_id = uid for update;
  if o.id is null then raise exception 'unknown_gig' using errcode = '22023'; end if;
  if o.ny_date <> public.ny_today() then raise exception 'gig_expired' using errcode = '22023'; end if;
  if o.accepted_at is not null then return o; end if;
  if exists (select 1 from public.gig_offers where player_id = uid and accepted_at is not null and collected_at is null) then
    raise exception 'gig_active' using errcode = '22023';
  end if;
  if me.confidence < o.confidence_req then raise exception 'needs_confidence' using errcode = '22023'; end if;
  if me.energy < o.energy then raise exception 'no_energy' using errcode = '22023'; end if;
  update public.players set energy = energy - o.energy where id = uid;
  update public.gig_offers set accepted_at = public.game_now(), ready_at = public.game_now() + make_interval(mins => o.wait_minutes)
   where id = o.id returning * into o;
  return o;
end;
$$;

create function public.collect_gig(p_offer bigint)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  o public.gig_offers;
begin
  select * into o from public.gig_offers where id = p_offer and player_id = uid for update;
  if o.id is null or o.accepted_at is null then raise exception 'unknown_gig' using errcode = '22023'; end if;
  if o.collected_at is not null then return 0; end if;
  if o.ready_at > public.game_now() then raise exception 'not_ready' using errcode = '22023'; end if;
  update public.gig_offers set collected_at = public.game_now() where id = o.id;
  if public.ledger_once(uid, 'cash', o.pay, 'gig', o.id::text) then
    update public.players set bank_cash = bank_cash + o.pay where id = uid;
  end if;
  return o.pay;
end;
$$;

-- Shop (virtual cash). Clout per purchase has diminishing returns, and buying an item
-- back after selling it pays no clout. Houses end rent; cars start insurance or rental.
create function public.buy_item(p_sku text, p_mode text default 'buy')
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
  perform public.tick(uid);
  select * into me from public.players where id = uid for update;
  if me.id is null or me.home_id is null then raise exception 'no_player' using errcode = '28000'; end if;
  if p_mode = 'rent' and (cat <> 'cars' or coalesce((item ->> 'rentPerWeek')::int, 0) = 0) then raise exception 'not_rentable' using errcode = '22023'; end if;
  if exists (select 1 from public.player_items where player_id = uid and sku = p_sku) then raise exception 'already_owned' using errcode = '22023'; end if;
  if cat = 'houses' and me.house_sku is not null then raise exception 'already_own_house' using errcode = '22023'; end if;
  if cat = 'cars' and me.car_mode = 'owned' then raise exception 'already_own_car' using errcode = '22023'; end if;
  if cat = 'cars' and p_mode = 'rent' and me.car_mode = 'rented' then raise exception 'already_renting' using errcode = '22023'; end if;

  price := case when p_mode = 'rent' then (item ->> 'rentPerWeek')::int else (item ->> 'price')::int end;
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
         next_car_due = case when cat = 'cars' then today + (e -> 'bills' ->> 'periodDays')::int else next_car_due end
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

-- Selling (Clarifications section 5): 60% of value; clout already earned stays.
-- Selling a house restarts rent; selling a car ends its insurance.
create function public.sell_item(p_item bigint)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  it public.player_items;
  v_amount int;
  today date := public.ny_today();
  period int := (public.city() -> 'economy' -> 'bills' ->> 'periodDays')::int;
begin
  select * into it from public.player_items where id = p_item and player_id = uid for update;
  if it.id is null then raise exception 'unknown_item' using errcode = '22023'; end if;
  v_amount := floor(it.value * (public.city() -> 'economy' ->> 'sellRate')::numeric);
  delete from public.player_items where id = it.id;
  update public.players
     set bank_cash = bank_cash + v_amount,
         house_sku = case when it.category = 'houses' then null else house_sku end,
         next_rent_due = case when it.category = 'houses' then today + period else next_rent_due end,
         car_sku = case when it.category = 'cars' then null else car_sku end,
         car_mode = case when it.category = 'cars' then null else car_mode end,
         next_car_due = case when it.category = 'cars' then null else next_car_due end
   where id = uid;
  perform public.ledger_once(uid, 'cash', v_amount, 'sale', it.id::text);
  return v_amount;
end;
$$;

-- Your Look: wear owned fashion; one item per outfit slot.
create function public.equip_item(p_item bigint, p_on boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  it public.player_items;
  v_slot text;
begin
  select * into it from public.player_items where id = p_item and player_id = uid;
  if it.id is null or it.category <> 'fashion' then raise exception 'not_wearable' using errcode = '22023'; end if;
  v_slot := public.shop_item(it.sku) ->> 'slot';
  if p_on then
    update public.player_items pi set equipped = false
     where pi.player_id = uid and pi.category = 'fashion' and pi.id <> it.id
       and public.shop_item(pi.sku) ->> 'slot' = v_slot;
  end if;
  update public.player_items set equipped = p_on where id = it.id;
end;
$$;

-- Bills (protected: stories never touch them).
create function public.pay_bill(p_bill bigint)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  bl public.bills;
  me public.players;
begin
  perform public.tick(uid);
  select * into bl from public.bills where id = p_bill and player_id = uid for update;
  if bl.id is null then raise exception 'unknown_bill' using errcode = '22023'; end if;
  if bl.status <> 'due' then return; end if;
  select * into me from public.players where id = uid for update;
  if me.bank_cash < bl.amount then raise exception 'cant_afford' using errcode = '22023'; end if;
  update public.players set bank_cash = bank_cash - bl.amount where id = uid;
  update public.bills set status = 'paid', paid_at = now() where id = bl.id;
  perform public.ledger_once(uid, 'cash', -bl.amount, 'bill_' || bl.kind, bl.id::text);
end;
$$;

-- Staging only: move the game clock (time-travel testing). Refused unless dev tools are on.
create function public.dev_set_clock_offset(p_hours numeric)
returns timestamptz
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce((select (value ->> 'tools')::boolean from public.game_settings where key = 'dev'), false) is not true then
    raise exception 'dev_tools_off' using errcode = '42501';
  end if;
  update public.game_settings
     set value = jsonb_set(value, '{clockOffsetSeconds}', to_jsonb((p_hours * 3600)::bigint)), updated_at = now()
   where key = 'dev';
  return public.game_now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.city()', 'public.game_now()', 'public.ny_today()', 'public.city_minutes()'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.sync_player()', 'public.do_action(text, text)', 'public.attend_event(text)', 'public.accept_gig(bigint)',
    'public.collect_gig(bigint)', 'public.buy_item(text, text)', 'public.sell_item(bigint)', 'public.equip_item(bigint, boolean)',
    'public.pay_bill(bigint)', 'public.dev_set_clock_offset(numeric)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'public.tick(uuid)', 'public.ensure_daily(uuid)', 'public.complete_task(uuid, text, text)',
    'public.clout_multiplier(int, int)', 'public.rent_for(text)', 'public.cheapest_home()', 'public.shop_item(text)',
    'public.place_action(text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
