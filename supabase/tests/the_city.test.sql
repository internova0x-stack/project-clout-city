-- Scenario test for migration 0004 (v0.3 "The City"): a week of play on the
-- staging clock, then a month for rent. Run with scripts/test-db.sh (after first_party.test.sql).
\set ON_ERROR_STOP on
\pset tuples_only on
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
-- v0.8 (migration 0025): actions and events need the player at the place; these helpers put the
-- player there first, as if they had travelled.
create function pg_temp.act(p_place text, p_action text) returns jsonb language plpgsql security definer as $h$
begin update public.players set at_place = p_place where id = auth.uid(); return public.do_action(p_place, p_action); end $h$;
create function pg_temp.attend(p_event text) returns jsonb language plpgsql security definer as $h$
begin
  update public.players set at_place = (select x ->> 'placeId' from jsonb_array_elements(public.city() -> 'events') x where x ->> 'id' = p_event)
   where id = auth.uid();
  return public.attend_event(p_event);
end $h$;
create function pg_temp.attend_x(p_event text) returns jsonb language plpgsql security definer as $h$
begin
  update public.players set at_place = (select place_id from public.exclusive_events where id = p_event) where id = auth.uid();
  return public.attend_exclusive_event(p_event);
end $h$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000010');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000010', false);
select 1 from public.create_player('Gus', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']);
select 1 from public.roll_birth_lottery();
select 1 from public.move_in('jackson_heights_1br');

-- The time-travel control is refused while dev tools are off.
do $$ begin
  begin perform public.dev_set_clock_offset(1); raise exception 'FAIL: dev clock allowed';
  exception when sqlstate '42501' then null; end;
end $$;

-- Known starting numbers, and dev tools on (staging).
reset role;
update public.players set bank_cash = 5000, energy = 100, mood = 50, confidence = 50 where display_name = 'Gus';
update public.game_settings set value = '{"tools": true, "clockOffsetSeconds": 0}' where key = 'dev';
set role authenticated;

-- Day 0: syncing makes five daily tasks and starts the weekly bills.
select 1 from public.sync_player();
select pg_temp.assert((select count(*) from public.daily_tasks) = 5, 'five daily tasks');
select pg_temp.assert((select next_rent_due = (public.ny_today() + interval '1 month')::date from public.players where display_name = 'Gus'), 'rent due in a month');
select next_rent_due - public.ny_today() as rent_in from public.players where display_name = 'Gus' \gset

-- Eating: clout once a day per place, by price; Energy restored; cash every time.
select (pg_temp.act('lucky-seven-deli', 'eat') ->> 'clout')::int as eat1 \gset
select pg_temp.assert(:eat1 = 9, 'deli clout (5 + 7*0.6) * 1.0 = 9');
select (pg_temp.act('lucky-seven-deli', 'eat') ->> 'clout')::int as eat2 \gset
select pg_temp.assert(:eat2 = 0, 'second meal pays no clout');

-- A club visit: clout, Mood and Confidence once, Energy spent.
select (pg_temp.act('velvet-static', 'visit') ->> 'clout')::int as club \gset
select pg_temp.assert(:club = 41, 'club clout (5 + 60*0.6) * 1.0 = 41');
select pg_temp.assert((select mood = 56 and confidence = 54 and energy = 85 from public.players where display_name = 'Gus'), 'club stats');

-- A shift pays the job rate and costs Energy.
select (pg_temp.act('grind-and-gossip', 'shift') ->> 'clout')::int as shift_clout \gset
select pg_temp.assert(:shift_clout = 0, 'shifts pay no clout');
select pg_temp.assert((select energy = 60 from public.players where display_name = 'Gus'), 'shift energy');

-- At low Energy, visits are refused but meals still work.
reset role;
update public.players set energy = 10 where display_name = 'Gus';
set role authenticated;
do $$ begin
  begin perform pg_temp.act('velvet-static', 'visit'); raise exception 'FAIL: visit at low energy';
  exception when sqlstate '22023' then null; end;
end $$;
select 1 from pg_temp.act('altitude-718', 'eat');
select pg_temp.assert((select energy = 65 from public.players where display_name = 'Gus'), 'meal restores energy');
do $$ begin
  begin perform pg_temp.act('nowhere', 'visit'); raise exception 'FAIL: unknown place';
  exception when sqlstate '22023' then null; end;
end $$;

-- Cash so far: 5000 - 7 - 7 - 60 + 120 - 95, plus whatever daily tasks paid.
select pg_temp.assert(
  (select bank_cash from public.players where display_name = 'Gus')
    = 5000 - 7 - 7 - 60 + 120 - 95 + coalesce((select sum(amount) from public.ledger l join public.players p on p.id = l.player_id
                                                 where p.display_name = 'Gus' and l.kind in ('daily_task', 'daily_bonus')), 0),
  'cash after actions matches the ledger');

-- Gigs: one at a time, cash after the wait, no clout.
reset role;
insert into public.gig_offers (player_id, ny_date, tier, title, pay, energy, wait_minutes, confidence_req)
select id, public.ny_today(), 'side', 'Test gig', 300, 30, 60, 0 from public.players where display_name = 'Gus';
insert into public.gig_offers (player_id, ny_date, tier, title, pay, energy, wait_minutes, confidence_req)
select id, public.ny_today(), 'big', 'Test big gig', 1500, 60, 240, 80 from public.players where display_name = 'Gus';
set role authenticated;
select id as gig from public.gig_offers where title = 'Test gig' \gset
select id as big_gig from public.gig_offers where title = 'Test big gig' \gset
do $$ begin
  begin perform public.accept_gig((select id from public.gig_offers where title = 'Test big gig')); raise exception 'FAIL: big gig without confidence';
  exception when sqlstate '22023' then null; end;
end $$;
select 1 from public.accept_gig(:gig);
do $$ begin
  begin perform public.collect_gig((select id from public.gig_offers where title = 'Test gig')); raise exception 'FAIL: collected early';
  exception when sqlstate '22023' then null; end;
end $$;
select bank_cash as before_gig, clout as clout_before_gig from public.players where display_name = 'Gus' \gset
select 1 from public.dev_set_clock_offset(1.1);
select pg_temp.assert(public.collect_gig(:gig) = 300, 'gig pays');
select pg_temp.assert(public.collect_gig(:gig) = 0, 'gig pays once');
select pg_temp.assert((select bank_cash = :before_gig + 300 and clout = :clout_before_gig from public.players where display_name = 'Gus'), 'gig cash, no clout');

-- Club events: doors follow the city clock. Move to 23:00 city time, then attend once.
reset role;
select ((23 * 60 - public.city_minutes() + 1440) % 1440) * 5.0 / 60 / 60 + 1.1 as to_doors \gset
update public.game_settings set value = jsonb_set(value, '{clockOffsetSeconds}', to_jsonb((:to_doors * 3600)::bigint)) where key = 'dev';
update public.players set energy = 100 where display_name = 'Gus';
set role authenticated;
select pg_temp.assert(public.city_minutes() between 23 * 60 and 23 * 60 + 2, 'clock at 23:00');
do $$ begin
  begin perform pg_temp.attend('golden-hour'); raise exception 'FAIL: closed event attended';
  exception when sqlstate '22023' then null; end;
end $$;
select (pg_temp.attend('neon-nights') ->> 'clout')::int as went \gset
select pg_temp.assert(:went = 62, 'event clout 60 * (0.7 + 0.3*0.56 + 0.3*0.54) = 62');
do $$ begin
  begin perform pg_temp.attend('neon-nights'); raise exception 'FAIL: event attended twice';
  exception when sqlstate '22023' then null; end;
end $$;

-- Shop: diminishing clout, 60% resale, no clout for buying back, one top at a time.
select 1 from public.dev_set_clock_offset(0);
select (public.buy_item('fit-varsity-tee') ->> 'clout')::int as tee1 \gset
select (public.buy_item('fit-satin-bomber') ->> 'clout')::int as bomber \gset
select pg_temp.assert(:tee1 = 10 and :bomber = 21, 'diminishing purchase clout (25 * 0.85 = 21)');
do $$ begin
  begin perform public.buy_item('fit-varsity-tee'); raise exception 'FAIL: bought twice';
  exception when sqlstate '22023' then null; end;
end $$;
select id as tee_id from public.player_items where sku = 'fit-varsity-tee' \gset
select id as bomber_id from public.player_items where sku = 'fit-satin-bomber' \gset
select 1 from public.equip_item(:tee_id, true);
select 1 from public.equip_item(:bomber_id, true);
select pg_temp.assert((select count(*) = 1 from public.player_items where equipped), 'one top equipped');
select pg_temp.assert(public.sell_item(:tee_id) = 39, 'sell at 60%');
select (public.buy_item('fit-varsity-tee') ->> 'clout')::int as tee2 \gset
select pg_temp.assert(:tee2 = 0, 'buying back pays no clout');
do $$ begin
  begin perform public.buy_item('lux-designer-watch', 'rent'); raise exception 'FAIL: rented a watch';
  exception when sqlstate '22023' then null; end;
end $$;
select 1 from public.buy_item('car-hatchback', 'rent');
select pg_temp.assert((select car_mode = 'rented' from public.players where display_name = 'Gus'), 'renting a car');

-- One week later: only the weekly car rental is due.
select 1 from public.dev_set_clock_offset(7 * 24);
select 1 from public.sync_player();
select pg_temp.assert((select count(*) = 1 from public.bills where status = 'due' and kind = 'car_rental'), 'car rental due weekly');
select pg_temp.assert((select count(*) = 0 from public.bills where kind in ('rent', 'phone')), 'no rent or phone bill after a week');

-- A month in: rent and the phone bill come due; pay the phone, skip rent.
select 1 from public.dev_set_clock_offset(:rent_in * 24);
select 1 from public.sync_player();
select pg_temp.assert((select count(*) = 1 from public.bills where status = 'due' and kind = 'rent' and amount = 3200), 'monthly rent due');
select id as phone_bill from public.bills where kind = 'phone' \gset
select 1 from public.pay_bill(:phone_bill);
select 1 from public.pay_bill(:phone_bill);
select pg_temp.assert((select count(*) = 1 from public.ledger where kind = 'bill_phone'), 'phone paid once');
select pg_temp.assert((select next_rent_due = (public.ny_today() + interval '1 month')::date from public.players where display_name = 'Gus'), 'next rent a month later');
select mood as mood_due from public.players where display_name = 'Gus' \gset

-- Within the grace period: no penalty. Four days late: Mood drops once.
select 1 from public.dev_set_clock_offset((:rent_in + 3) * 24);
select 1 from public.sync_player();
select pg_temp.assert((select mood = :mood_due from public.players where display_name = 'Gus'), 'no penalty in grace');
select 1 from public.dev_set_clock_offset((:rent_in + 4) * 24);
select 1 from public.sync_player();
select 1 from public.sync_player();
select pg_temp.assert((select mood = :mood_due - 8 from public.players where display_name = 'Gus'), 'mood drops 8 after grace');

-- A week late: moved to the cheapest home, old rent forgiven, a new rent bill.
select 1 from public.dev_set_clock_offset((:rent_in + 7) * 24);
select 1 from public.sync_player();
select pg_temp.assert((select home_id = 'astoria_studio' from public.players where display_name = 'Gus'), 'evicted to cheapest home');
select pg_temp.assert((select count(*) = 1 from public.bills where kind = 'rent' and status = 'due' and amount = 2100), 'new rent bill');
select pg_temp.assert((select next_rent_due = (public.ny_today() + interval '1 month')::date from public.players where display_name = 'Gus'), 'new rent monthly');

-- Clout never moved without a ledger row.
reset role;
select pg_temp.assert(
  (select clout from public.players where display_name = 'Gus')
    = (select sum(amount) from public.ledger l join public.players p on p.id = l.player_id
        where p.display_name = 'Gus' and l.currency = 'clout'),
  'clout matches the ledger');
update public.game_settings set value = '{"tools": false, "clockOffsetSeconds": 0}' where key = 'dev';
select 'CITY CHECKS PASSED' as result;
