-- Scenario test for migrations 0025 and 0040 (travel: be there to act; prices by distance band;
-- trips take real time and can be skipped for virtual cash).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000f1');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
select 1 from public.create_player('traveller', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set bank_cash = 1000, energy = 100 where display_name = 'traveller';
set role authenticated;

-- Everyone starts at home, and can't act anywhere else.
select pg_temp.assert((select at_place from public.players where id = auth.uid()) is null, 'starts at home');
select pg_temp.assert(pg_temp.raises($$select public.do_action('ditmars-deli', 'eat')$$, 'not_here'), 'no spending before arriving');

-- Ditmars Deli is 0.4 mi from the Astoria studio: under 0.5 mi, so a taxi is C$18 (v0.11).
create temp table t1 as select public.travel('ditmars-deli', 'taxi') as r;
select pg_temp.assert((select (r ->> 'cash')::int from t1) = -18, 'short taxi: C$18');
select pg_temp.assert((select (r ->> 'seconds')::int = public.trip_seconds('taxi', (r ->> 'miles')::numeric) from t1), 'trip time from the seed');
select pg_temp.assert((select (r ->> 'seconds')::int between 5 and 12 from t1), 'a short trip: a few seconds');
select pg_temp.assert((select bank_cash from public.players where id = auth.uid()) = 982, 'fare charged');
select pg_temp.assert(exists (select 1 from public.ledger where player_id = auth.uid() and kind = 'travel' and amount = -18), 'fare in the ledger');
-- On the way: nothing happens at the deli until the player gets there (#13).
select pg_temp.assert(pg_temp.raises($$select public.do_action('ditmars-deli', 'eat')$$, 'still_travelling'), 'no acting mid-trip');
-- Skipping costs C$1 per 2 seconds left, at least C$5, and pays once.
create temp table k as select public.skip_trip() as r;
select pg_temp.assert((select (r ->> 'cash')::int = -5 from k), 'skip: C$5 minimum');
select pg_temp.assert((select bank_cash from public.players where id = auth.uid()) = 977, 'skip charged');
select pg_temp.assert(exists (select 1 from public.ledger where player_id = auth.uid() and kind = 'travel_skip' and amount = -5), 'skip in the ledger');
select pg_temp.assert((public.skip_trip() ->> 'cash')::int = 0, 'nothing left to skip: free');
select 1 from public.do_action('ditmars-deli', 'eat');
select pg_temp.assert(public.travel('ditmars-deli', 'taxi') ->> 'already' = 'true', 'already there costs nothing');

-- Longer trips take longer, up to a minute.
select pg_temp.assert(public.trip_seconds('walk', 3) = 60 and public.trip_seconds('subway', 7) = 45
  and public.trip_seconds('taxi', 0.4) < public.trip_seconds('taxi', 3), 'time grows with distance, capped');

-- Gantry Plaza is about 3 mi from the deli: 2 to 5 mi. Walking costs 20 Energy; the subway is flat.
create temp table e0 as select energy from public.players where id = auth.uid();
grant select on e0 to authenticated;
select pg_temp.assert((public.travel('gantry-plaza', 'walk') ->> 'energy')::int = -20, 'a long walk: 20 Energy');
select pg_temp.assert((select energy from public.players where id = auth.uid()) = (select energy from e0) - 20, 'Energy spent');
select pg_temp.assert((public.travel('home', 'subway') ->> 'cash')::int = -6, 'subway: C$6 flat');
select pg_temp.assert((select at_place from public.players where id = auth.uid()) is null, 'home again');

-- St. Johnsons is about 7 mi away: too far to walk; no car, no driving.
select pg_temp.assert(pg_temp.raises($$select public.travel('st-johnsons', 'walk')$$, 'too_far_to_walk'), 'too far to walk');
select pg_temp.assert(pg_temp.raises($$select public.travel('st-johnsons', 'car')$$, 'no_car'), 'no car');
create temp table far as select public.travel('st-johnsons', 'taxi') as r;
select pg_temp.assert((select (r ->> 'cash')::int = -95 from far), 'long taxi: C$95');
select pg_temp.assert((select (r ->> 'seconds')::int = 60 from far), 'a long ride: a minute');
-- A long skip costs more: C$1 for every 2 seconds left.
reset role;
update public.players set arrives_at = clock_timestamp() + interval '40 seconds' where display_name = 'traveller';
set role authenticated;
select pg_temp.assert((public.skip_trip() ->> 'cash')::int = -20, '40 s left: C$20');
select pg_temp.assert(pg_temp.raises($$select public.travel('skyline-pier', 'taxi')$$, 'unknown_place'), 'story places before their story');

rollback;
\echo TRAVEL CHECKS PASSED
