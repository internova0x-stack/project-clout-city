-- Scenario test for migration 0160 (no tasks from the bench): a task at the 114½ Precinct isn't done while the player is
-- held there, and is done once they're out. Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000160');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000160', false);
select public.create_player('Bench', 'bodega_drip', '{}', null, true);
select public.set_traits(array['loud', 'hustler']);
select public.roll_birth_lottery();
select public.move_in('astoria_studio');
reset role;
\set p '''00000000-0000-0000-0000-000000000160'''

-- Today's list, with one task at the precinct.
select public.ensure_daily(:p);
update public.daily_tasks set place_id = 'precinct-114-half', action_id = 'report', kind = 'visit', done_at = null
 where id = (select id from public.daily_tasks where player_id = :p and ny_date = public.ny_today() order by slot limit 1);
create temp table t as select id, reward from public.daily_tasks where player_id = :p and place_id = 'precinct-114-half';

select public.choice_apply(:p, '{"holding": 2}', 'choice', 'bench-test');
select pg_temp.assert(public.complete_task(:p, 'precinct-114-half', 'report') = 0, 'nothing pays from the bench');
select pg_temp.assert((select done_at is null from public.daily_tasks where id = (select id from t)), 'the task waits');

select public.choice_bail(:p);
select pg_temp.assert(public.complete_task(:p, 'precinct-114-half', 'report') >= (select reward from t), 'out on bail, it counts');
select pg_temp.assert((select done_at is not null from public.daily_tasks where id = (select id from t)), 'done now');

rollback;
\echo no_tasks_in_holding: ok
