-- Scenario test for migration 0026 (Nap and Sit at home, capped; drinks at club and lounge bars).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a9');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a9', false);
select 1 from public.create_player('rester', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set energy = 20, mood = 40, bank_cash = 500 where display_name = 'rester';
set role authenticated;

-- Naps: +30 Energy, twice a day, home only.
select pg_temp.assert((public.rest('nap') ->> 'energy')::int = 30, 'a nap is +30 Energy');
select pg_temp.assert((public.rest('nap') ->> 'left')::int = 0, 'the second nap is the last');
select pg_temp.assert(pg_temp.raises($$select public.rest('nap')$$, 'rested_out'), 'no third nap');
select pg_temp.assert((select energy from public.players where id = auth.uid()) = 80, 'two naps: 20 → 80');

-- Sitting: +10 Energy (capped at 100) and +6 Mood, three times a day.
select pg_temp.assert((public.rest('sit') ->> 'mood')::int = 6, 'sitting lifts Mood');
select pg_temp.assert((public.rest('sit') ->> 'energy')::int = 10, 'sitting gives Energy');
select pg_temp.assert((public.rest('sit') ->> 'energy')::int = 0, 'Energy stops at 100');
select pg_temp.assert(pg_temp.raises($$select public.rest('sit')$$, 'rested_out'), 'no fourth sit');

-- Away from home, no resting; at the bar, a drink.
reset role;
update public.players set energy = 50 where display_name = 'rester';
set role authenticated;
select pg_temp.assert(pg_temp.raises($$select public.bar_drink('velvet-static')$$, 'not_here'), 'drinks need you there');
select 1 from public.travel('velvet-static', 'taxi');
select pg_temp.assert(pg_temp.raises($$select public.bar_drink('velvet-static')$$, 'still_travelling'), 'no drinks mid-trip');
select 1 from public.skip_trip();
select pg_temp.assert(pg_temp.raises($$select public.rest('nap')$$, 'not_home'), 'naps are at home');
create temp table d as select public.bar_drink('velvet-static') as r;
select pg_temp.assert((select (r ->> 'cash')::int = -60 and (r ->> 'energy')::int = 20 from d), 'C$60 for +20 Energy (v0.11)');
select pg_temp.assert(exists (select 1 from public.ledger where player_id = auth.uid() and kind = 'drink'), 'the drink is in the ledger');
select pg_temp.assert(not exists (select 1 from public.ledger where player_id = auth.uid() and kind = 'visit'), 'drinks pay no clout');
reset role;
update public.players set energy = 100 where display_name = 'rester';
set role authenticated;
select pg_temp.assert(pg_temp.raises($$select public.bar_drink('velvet-static')$$, 'full_energy'), 'no paying for nothing at full Energy');
select 1 from public.travel('ditmars-deli', 'taxi');
select 1 from public.skip_trip();
select pg_temp.assert(pg_temp.raises($$select public.bar_drink('ditmars-deli')$$, 'unknown_action'), 'no bar at the deli');

rollback;
\echo REST CHECKS PASSED
