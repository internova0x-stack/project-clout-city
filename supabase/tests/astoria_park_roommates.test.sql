-- Scenario test for migration 0094 (culture pack C3: Astoria Park, jobs, the roommate, first-day tasks and goals).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.act(p_place text, p_action text) returns jsonb language plpgsql security definer as $h$
begin update public.players set at_place = p_place where id = auth.uid(); return public.do_action(p_place, p_action); end $h$;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.goal_done(p_goal text) returns boolean language sql as $$
  select (g ->> 'done')::boolean from jsonb_array_elements(public.goal_list('00000000-0000-0000-0000-000000000941')) g where g ->> 'id' = p_goal $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000941');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000941', false);
select 1 from public.create_player('newinqueens', 'arcade_nerd', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery();
-- The roommate share is a sign-up home: the player's half is C$900.
select pg_temp.assert((public.move_in('astoria_share')).home_id = 'astoria_share', 'moved into the share');
reset role;
select pg_temp.assert((select -amount = 900 from public.ledger where player_id = '00000000-0000-0000-0000-000000000941' and kind = 'rent'), 'first rent: your half, C$900');
update public.players set energy = 100, bank_cash = 2000 where id = '00000000-0000-0000-0000-000000000941';

-- Day one: the BEC, the cat and a lap come first; five tasks in all.
select public.ensure_daily('00000000-0000-0000-0000-000000000941');
select pg_temp.assert((select array_agg(place_id || '/' || action_id order by slot)
                         from public.daily_tasks where player_id = '00000000-0000-0000-0000-000000000941' and slot <= 3)
                      = array['ditmars-deli/bec', 'ditmars-deli/pet-cat', 'hell-gate-park/lap'], 'the three first-day tasks, in order');
select pg_temp.assert((select count(*) = 5 from public.daily_tasks where player_id = '00000000-0000-0000-0000-000000000941'), 'five tasks, no more');

-- Both new goals are on the ladder, not done yet.
select pg_temp.assert(not pg_temp.goal_done('regular') and not pg_temp.goal_done('own_place'), 'both goals open on day one');
select pg_temp.assert((public.goal_current('00000000-0000-0000-0000-000000000941') ->> 'id') = 'regular', 'becoming a regular is the first goal');

set role authenticated;
select 1 from pg_temp.act('ditmars-deli', 'bec');
select 1 from pg_temp.act('ditmars-deli', 'pet-cat');
select pg_temp.assert((pg_temp.act('hell-gate-park', 'lap') ->> 'mood')::int = 4, 'a lap: +4 Mood');
select pg_temp.assert((pg_temp.act('hell-gate-park', 'hangout') ->> 'mood')::int = 12, 'sitting on the bench: +12 Mood');
-- The dog-walking shift pays C$110.
select pg_temp.assert((pg_temp.act('hell-gate-park', 'walk-dogs') ->> 'cash')::int >= 110, 'walking dogs pays C$110');
reset role;
select pg_temp.assert((select count(*) = 3 from public.daily_tasks where player_id = '00000000-0000-0000-0000-000000000941'
                        and slot <= 3 and done_at is not null), 'the three first-day tasks are done');
select pg_temp.assert(exists (select 1 from public.ledger where player_id = '00000000-0000-0000-0000-000000000941'
                               and kind = 'shift' and amount = 110), 'the shift is on the ledger');

-- Two more days at Sal's make a regular; moving to the studio is your own place.
update public.players set at_place = 'ditmars-deli' where id = '00000000-0000-0000-0000-000000000941';
insert into public.place_visits (player_id, place_id, ny_date)
select '00000000-0000-0000-0000-000000000941', 'ditmars-deli', public.ny_today() - d from generate_series(1, 2) d;
select pg_temp.assert(pg_temp.goal_done('regular'), 'three different days at Sal''s: a regular');
update public.players set home_id = 'astoria_studio' where id = '00000000-0000-0000-0000-000000000941';
select pg_temp.assert(pg_temp.goal_done('own_place'), 'no roommate: your own place');

-- A player who moved in before today gets the usual list.
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000942');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000942', false);
select 1 from public.create_player('oldtimer', 'arcade_nerd', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set moved_in_at = now() - interval '3 days' where id = '00000000-0000-0000-0000-000000000942';
delete from public.daily_tasks where player_id = '00000000-0000-0000-0000-000000000942';
select public.ensure_daily('00000000-0000-0000-0000-000000000942');
select pg_temp.assert((select coalesce(array_agg(place_id || '/' || action_id order by slot), '{}') from public.daily_tasks
                        where player_id = '00000000-0000-0000-0000-000000000942' and ny_date = public.ny_today() and slot <= 3)
                      <> array['ditmars-deli/bec', 'ditmars-deli/pet-cat', 'hell-gate-park/lap'], 'returning players get the usual list');

rollback;
\echo ASTORIA PARK AND ROOMMATE CHECKS PASSED
