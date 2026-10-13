-- Scenario test for migrations 0030 and 0031 (monument plazas: five activities each, each with its
-- own Mood and Confidence once a day; clout once a day per place).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.act(p_place text, p_action text) returns jsonb language plpgsql security definer as $h$
begin update public.players set at_place = p_place where id = auth.uid(); return public.do_action(p_place, p_action); end $h$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000b3');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b3', false);
select 1 from public.create_player('tourist', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set energy = 60, mood = 40, confidence = 40, bank_cash = 500 where display_name = 'tourist';
set role authenticated;

-- The Unisphere: the globe pays the day's clout; the rest are for the stats.
select pg_temp.assert((pg_temp.act('unisphere', 'visit') ->> 'clout')::int = 20, 'posing with the globe: 20 clout');
select pg_temp.assert((pg_temp.act('unisphere', 'tour') ->> 'confidence')::int = 5, 'Walt''s tour lifts Confidence');
select pg_temp.assert((pg_temp.act('unisphere', 'wish') ->> 'mood')::int = 4, 'a coin in the fountain');
-- Today's daily tasks are random: one may land here and pay, so its reward is left out.
select pg_temp.assert((select p.bank_cash - coalesce((select sum(amount) from public.ledger l where l.player_id = p.id and l.kind in ('daily_task', 'daily_bonus')), 0) = 500 - 15 - 1
  from public.players p where p.display_name = 'tourist'), 'the tour is C$15 and the coin C$1');
select pg_temp.assert((pg_temp.act('unisphere', 'pretzel') ->> 'energy')::int = 12, 'a pretzel is +12 Energy');
select pg_temp.assert((pg_temp.act('unisphere', 'people') ->> 'mood')::int = 6, 'people-watching');

select pg_temp.assert((pg_temp.act('unisphere', 'people') ->> 'mood')::int = 0, 'the same activity twice: no second boost');
select pg_temp.assert((pg_temp.act('unisphere', 'visit') ->> 'clout')::int = 0, 'clout once a day per place');

-- Gantry Plaza.
select pg_temp.assert((pg_temp.act('gantry-plaza', 'photoshoot') ->> 'confidence')::int = 6, 'golden hour photoshoot');
select pg_temp.assert((pg_temp.act('gantry-plaza', 'picnic') ->> 'energy')::int = 20, 'a picnic is +20 Energy');
select pg_temp.assert((pg_temp.act('gantry-plaza', 'ferries') ->> 'mood')::int = 7, 'watching the ferries');
select pg_temp.assert((pg_temp.act('gantry-plaza', 'run') ->> 'confidence')::int = 5, 'running the river path');

rollback;
\echo MONUMENT CHECKS PASSED
