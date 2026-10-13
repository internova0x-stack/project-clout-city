-- Scenario test for migration 0025 (travel: be there to act; prices by distance band).
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

-- Ditmars Deli is 0.4 mi from the Astoria studio: under 0.5 mi, so a taxi is C$8.
create temp table t1 as select public.travel('ditmars-deli', 'taxi') as r;
select pg_temp.assert((select (r ->> 'cash')::int from t1) = -8, 'short taxi: C$8');
select pg_temp.assert((select (r ->> 'seconds')::int between 3 and 10 from t1), 'a short trip');
select pg_temp.assert((select bank_cash from public.players where id = auth.uid()) = 992, 'fare charged');
select pg_temp.assert(exists (select 1 from public.ledger where player_id = auth.uid() and kind = 'travel' and amount = -8), 'fare in the ledger');
select 1 from public.do_action('ditmars-deli', 'eat');
select pg_temp.assert(public.travel('ditmars-deli', 'taxi') ->> 'already' = 'true', 'already there costs nothing');

-- Gantry Plaza is about 3 mi from the deli: 2 to 5 mi. Walking costs 20 Energy; the subway is flat.
create temp table e0 as select energy from public.players where id = auth.uid();
grant select on e0 to authenticated;
select pg_temp.assert((public.travel('gantry-plaza', 'walk') ->> 'energy')::int = -20, 'a long walk: 20 Energy');
select pg_temp.assert((select energy from public.players where id = auth.uid()) = (select energy from e0) - 20, 'Energy spent');
select pg_temp.assert((public.travel('home', 'subway') ->> 'cash')::int = -3, 'subway: C$3 flat');
select pg_temp.assert((select at_place from public.players where id = auth.uid()) is null, 'home again');

-- St. Johnsons is about 7 mi away: too far to walk; no car, no driving.
select pg_temp.assert(pg_temp.raises($$select public.travel('st-johnsons', 'walk')$$, 'too_far_to_walk'), 'too far to walk');
select pg_temp.assert(pg_temp.raises($$select public.travel('st-johnsons', 'car')$$, 'no_car'), 'no car');
select pg_temp.assert((public.travel('st-johnsons', 'taxi') ->> 'cash')::int = -45, 'long taxi: C$45');
select pg_temp.assert(pg_temp.raises($$select public.travel('skyline-pier', 'taxi')$$, 'unknown_place'), 'story places before their story');

rollback;
\echo TRAVEL CHECKS PASSED
