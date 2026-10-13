-- Scenario test for migration 0027 (groceries at the supermarket, the fridge, cooking at home).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000b1');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select 1 from public.create_player('cook', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set energy = 40, bank_cash = 500 where display_name = 'cook';
set role authenticated;

-- An empty fridge, and nothing to buy from home.
select pg_temp.assert((select fridge_meals from public.players where id = auth.uid()) = 0, 'the fridge starts empty');
select pg_temp.assert(pg_temp.raises($$select public.cook()$$, 'fridge_empty'), 'no cooking from an empty fridge');
select pg_temp.assert(pg_temp.raises($$select public.buy_groceries('steinway-fresh', 'meal-prep')$$, 'not_here'), 'groceries need you at the store');

-- At the store: bundles fill the fridge up to 10 meals.
select 1 from public.travel('steinway-fresh', 'taxi');
select pg_temp.assert(pg_temp.raises($$select public.buy_groceries('steinway-fresh', 'caviar')$$, 'unknown_bundle'), 'only real bundles');
create temp table b as select public.buy_groceries('steinway-fresh', 'meal-prep') as r;
select pg_temp.assert((select (r ->> 'cash')::int = -35 and (r ->> 'meals')::int = 7 from b), 'meal prep: C$35 for 7 meals');
select pg_temp.assert((public.buy_groceries('steinway-fresh', 'snack-run') ->> 'meals')::int = 9, 'a snack run adds 2');
select pg_temp.assert(pg_temp.raises($$select public.buy_groceries('steinway-fresh', 'snack-run')$$, 'fridge_full'), 'no buying what does not fit');
select pg_temp.assert((select count(*) from public.ledger where player_id = auth.uid() and kind = 'groceries') = 2, 'both trips are in the ledger');
select pg_temp.assert(not exists (select 1 from public.player_items where player_id = auth.uid()), 'groceries are not possessions');
select pg_temp.assert(pg_temp.raises($$select public.cook()$$, 'not_home'), 'cooking is at home');

-- Home: a meal for +25 Energy, capped at 100.
select 1 from public.travel('home', 'taxi');
create temp table c as select public.cook() as r;
select pg_temp.assert((select (r ->> 'energy')::int = 25 and (r ->> 'meals')::int = 8 from c), 'cooking: +25 Energy, one meal used');
reset role;
update public.players set energy = 90 where display_name = 'cook';
set role authenticated;
select pg_temp.assert((public.cook() ->> 'energy')::int = 10, 'Energy stops at 100');
select pg_temp.assert(pg_temp.raises($$select public.cook()$$, 'full_energy'), 'no wasting a meal at full Energy');
select pg_temp.assert((select fridge_meals from public.players where id = auth.uid()) = 7, 'seven left');
select pg_temp.assert(pg_temp.raises($$select public.buy_groceries('velvet-static', 'snack-run')$$, 'unknown_action'), 'no groceries at the club');

-- No direct writes to the fridge (RLS blocks the update, or it touches nothing).
do $$ begin update public.players set fridge_meals = 10 where id = auth.uid(); exception when others then null; end $$;
select pg_temp.assert((select fridge_meals from public.players where id = auth.uid()) = 7, 'RLS blocks direct writes');

rollback;
\echo GROCERIES CHECKS PASSED
