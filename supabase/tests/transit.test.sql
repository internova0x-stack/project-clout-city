-- Scenario test for migration 0095 (culture pack C4: lines, delays, the OMG Card, the rideshare, showtime dancers,
-- the lotto in Flushing and no listening in at a shut place). Runs in a transaction and rolls back.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;
-- Puts the player somewhere, trip over.
create function pg_temp.at(p text) returns void language plpgsql security definer as $h$
begin update public.players set at_place = p, arrives_at = null where id = auth.uid(); end $h$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000951');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000951', false);
select 1 from public.create_player('rider', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set bank_cash = 1000, energy = 100 where id = '00000000-0000-0000-0000-000000000951';

-- The lotto is in Queens now (Flushing): open to everyone, no borough lock.
select pg_temp.assert((select p ->> 'borough' = 'queens' and p ->> 'area' = 'Flushing' from jsonb_array_elements(public.city() -> 'places') p where p ->> 'id' = 'lucky-star'), 'Lucky Star is in Flushing');
select pg_temp.assert(public.place_open('lucky-star'), 'and open');

-- The subway to Flushing rides the 7: C$6, no delay yet.
set role authenticated;
select pg_temp.at('ditmars-deli');
create temp table t1 as select public.travel('queensborough-u', 'subway') as r;
grant all on t1 to authenticated;
select pg_temp.assert((select r ->> 'line' = '7' and (r ->> 'delay')::int = 0 and (r ->> 'cash')::int = -6 from t1), 'subway to Flushing: the 7, C$6');

-- A delay posted in News on the 7, running now, makes the same trip longer by its seconds; the N/W isn't touched.
reset role;
insert into public.news_items (id, kind, headline, body, publish_on, status, transit)
select 'test-7-delay', 'transit', '7 train delays for the test', 'A signal is thinking about it. Expect delays on the 7.', ny::date, 'approved',
       jsonb_build_object('line', '7', 'from', to_char(date_trunc('hour', ny), 'HH24:MI'), 'hours', 1, 'delay', 20)
  from (select public.game_now() at time zone 'America/New_York' as ny) c;
select pg_temp.assert(public.transit_delay('7') = 20, 'a 20-second delay on the 7 now');
select pg_temp.assert(public.transit_delay('N/W') = 0, 'none on the N/W');
set role authenticated;
select pg_temp.at('ditmars-deli');
create temp table t2 as select public.travel('queensborough-u', 'subway') as r;
grant all on t2 to authenticated;
select pg_temp.assert((select (t2.r ->> 'delay')::int = 20 and (t2.r ->> 'seconds')::int = (t1.r ->> 'seconds')::int + 20 from t1, t2), 'the delay lengthens the train trip');
-- A cab ignores the trains.
select pg_temp.at('ditmars-deli');
select pg_temp.assert((public.travel('queensborough-u', 'taxi') ->> 'delay')::int = 0, 'the green cab has no delay');
-- The rideshare: faster than the cab, pricier.
select pg_temp.at('ditmars-deli');
create temp table cab as select public.trip_seconds('taxi', 5.5) as s;
select pg_temp.assert(public.trip_seconds('rideshare', 5.5) < (select s from cab), 'the rideshare is quicker');
select pg_temp.assert((public.travel('queensborough-u', 'rideshare') ->> 'cash')::int = -133, 'and costs more (C$133 for the longest band)');
reset role;

-- The OMG Card: a week for C$70; the subway is free while it lasts; a second one stacks.
set role authenticated;
select pg_temp.assert(pg_temp.raises($$select public.buy_transit_pass('year')$$, 'unknown_pass'), 'only the two passes');
select pg_temp.assert((public.buy_transit_pass('week') ->> 'cash')::int = -70, 'a week costs C$70');
select pg_temp.at('ditmars-deli');
select pg_temp.assert((public.travel('queensborough-u', 'subway') ->> 'cash')::int = 0, 'rides are free with the card');
reset role;
select pg_temp.assert((select transit_pass_until between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour' from public.players where id = '00000000-0000-0000-0000-000000000951'), 'seven days');
set role authenticated;
select 1 from public.buy_transit_pass('week');
reset role;
select pg_temp.assert((select transit_pass_until > now() + interval '13 days' from public.players where id = '00000000-0000-0000-0000-000000000951'), 'a second week stacks');
select pg_temp.assert((select count(*) = 2 from public.ledger where player_id = '00000000-0000-0000-0000-000000000951' and kind = 'transit_pass'), 'both on the ledger');

-- Showtime: only when the server put dancers on this ride; +3 clout once a day.
set role authenticated;
select pg_temp.assert(pg_temp.raises($$select public.showtime_watch()$$, 'no_showtime'), 'no dancers, no clout');
reset role;
update public.players set showtime_until = now() + interval '1 minute' where id = '00000000-0000-0000-0000-000000000951';
create temp table c0 as select clout from public.players where id = '00000000-0000-0000-0000-000000000951';
set role authenticated;
select pg_temp.assert((public.showtime_watch() ->> 'clout')::int = 3, 'watching pays 3 clout');
reset role;
update public.players set showtime_until = now() + interval '1 minute' where id = '00000000-0000-0000-0000-000000000951';
set role authenticated;
select pg_temp.assert((public.showtime_watch() ->> 'clout')::int = 0, 'once a day');
reset role;
select pg_temp.assert((select clout = (select clout from c0) + 3 from public.players where id = '00000000-0000-0000-0000-000000000951'), 'three clout in all');
-- With today's clout paid, no more dancers today.
update public.players set at_place = 'ditmars-deli', arrives_at = null where id = '00000000-0000-0000-0000-000000000951';
set role authenticated;
select pg_temp.assert(not exists (select 1 from generate_series(1, 30) g where (select (public.travel(case when g % 2 = 0 then 'ditmars-deli' else 'queensborough-u' end, 'subway') ->> 'showtime')::boolean)), 'no showtime once paid today');
reset role;

-- News carries the transit details; the browser can't call the delay helper.
select pg_temp.assert((select bool_or(i ->> 'id' = 'test-7-delay' and i -> 'transit' ->> 'line' = '7') from jsonb_array_elements(public.news_feed()) i), 'news_feed has the transit item');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.transit_delay(text)', 'execute'), 'transit_delay is server-only');

-- No listening in at a shut place (owner, Oct 21): the halal cart opens at 6 PM.
insert into public.game_settings (key, value) values ('dev', '{}') on conflict (key) do nothing;
update public.game_settings set value = value || jsonb_build_object('clockOffsetSeconds',
  mod((12 * 60 + 30) * 5 - mod(extract(epoch from now())::numeric, 7200) + 7200, 7200)) where key = 'dev';
set role authenticated;
select pg_temp.at('white-sauce-cart');
select pg_temp.assert(pg_temp.raises($$select public.gossip_find('white-sauce-cart', 'overheard')$$, 'closed_now'), 'nobody to overhear at a shut cart');
reset role;

rollback;
\echo TRANSIT CHECKS PASSED
