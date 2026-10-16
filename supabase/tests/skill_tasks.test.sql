-- Scenario test for migration 0063 (a skill task in every daily list; cooking at home completes the cooking one).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000063a1');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000063a1', false);
select 1 from public.create_player('chef', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select 1 from public.sync_player();

-- Five tasks, exactly one a skill task, at a place the skill rules train it; no place twice.
select pg_temp.assert((select count(*) from public.daily_tasks) = 5, 'five daily tasks');
select pg_temp.assert((select count(*) from public.daily_tasks where skill is not null) = 1, 'one skill task');
select pg_temp.assert((select count(distinct place_id) from public.daily_tasks) = 5, 'no place twice');
select pg_temp.assert((select (kind = 'cook' and place_id = 'home' and skill = 'cooking')
                          or (kind = 'shift' and skill = 'hustle')
                          or skill = public.skill_for_place(place_id)
                         from public.daily_tasks where skill is not null), 'the skill matches the place');

-- Many fresh lists: the pick covers several skills, cooking among them.
reset role;
create temp table seen (skill text, kind text);
do $$ begin
  for i in 1..60 loop
    delete from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000063a1';
    perform public.ensure_daily('00000000-0000-0000-0000-0000000063a1');
    insert into seen select skill, kind from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000063a1' and skill is not null;
  end loop;
end $$;
select pg_temp.assert((select count(*) from seen) = 60, 'a skill task every time');
select pg_temp.assert((select count(distinct skill) from seen) >= 3, 'several skills come up');
select pg_temp.assert(exists (select 1 from seen where skill = 'cooking' and kind = 'cook'), 'cooking comes up');

-- A cooking task: cooking at home completes it and pays its cash.
update public.daily_tasks set kind = 'cook', place_id = 'home', action_id = 'cook', skill = 'cooking', reward = 75
 where player_id = '00000000-0000-0000-0000-0000000063a1' and skill is not null;
update public.players set energy = 40, fridge_meals = 2, at_place = null, bank_cash = 500 where display_name = 'chef';
set role authenticated;
create temp table c as select public.cook() as r;
select pg_temp.assert((select (r ->> 'taskCash')::int = 75 from c), 'the cooking task pays');
select pg_temp.assert((select done_at is not null from public.daily_tasks where skill = 'cooking'), 'the cooking task is done');
select pg_temp.assert((select bank_cash = 575 from public.players where display_name = 'chef'), 'cash paid once');
select pg_temp.assert((select (public.cook() ->> 'taskCash')::int = 0), 'cooking again pays no task');

rollback;
