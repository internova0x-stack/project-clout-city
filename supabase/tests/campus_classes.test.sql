-- Campus step 3b (migration 0076): "Go to class" in the daily tasks for students, done by attending a class, and free
-- study dates at the campuses. Runs in a transaction and rolls back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.at(p text) returns void language plpgsql security definer as $$
begin update public.players set at_place = p, arrives_at = null where id = auth.uid(); end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000076a1'), ('00000000-0000-0000-0000-0000000076a2');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000076a1', false);
select 1 from public.create_player('Stu', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select pg_temp.at('st-johnsons');
select 1 from public.campus_enrol('st-johnsons');
select 1 from public.campus_pick(array['napping-301', 'subway-studies', 'group-project']);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000076a2', false);
select 1 from public.create_player('Vis', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set energy = 100 where id = '00000000-0000-0000-0000-0000000076a1';

-- A fresh list: the student gets "Go to class" at their campus; still five tasks; the visitor doesn't.
delete from public.daily_tasks where player_id in ('00000000-0000-0000-0000-0000000076a1', '00000000-0000-0000-0000-0000000076a2');
select public.ensure_daily('00000000-0000-0000-0000-0000000076a1');
select public.ensure_daily('00000000-0000-0000-0000-0000000076a2');
select pg_temp.assert((select count(*) from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000076a1'
                        and kind = 'class' and place_id = 'st-johnsons' and action_id = 'class') = 1, 'Go to class for the student');
select pg_temp.assert((select count(*) from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000076a1') = 5, 'still five');
select pg_temp.assert(not exists (select 1 from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000076a2' and kind = 'class'), 'not for visitors');

-- Attending a class completes it and pays the task.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000076a1', false);
select pg_temp.assert((public.campus_attend('napping-301') ->> 'taskCash')::int > 0, 'class pays the task');
reset role;
select pg_temp.assert((select done_at is not null from public.daily_tasks where player_id = '00000000-0000-0000-0000-0000000076a1' and kind = 'class'), 'task done');

-- Study dates: the campuses are date spots, free.
select pg_temp.assert(public.date_target('place', 'st-johnsons') = '{"placeId": "st-johnsons", "price": 0}'::jsonb, 'study date at St. Johnsons, free');
select pg_temp.assert((public.date_target('place', 'queensborough-u') ->> 'price')::int = 0, 'and Queensborough');
select pg_temp.assert((public.date_target('place', 'ditmars-deli') ->> 'price')::int > 0, 'other date spots keep their meal price');

rollback;
\echo CAMPUS CLASSES CHECKS PASSED
