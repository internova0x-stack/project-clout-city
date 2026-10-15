-- Scenario test for migration 0054 (no next due date more than a week away).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000d1'), ('00000000-0000-0000-0000-0000000000d2');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select 1 from public.create_player('dueone', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', false);
select 1 from public.create_player('duetwo', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;

-- Player 1 still has month-ahead dates from the monthly days; player 2 is due in 3 days.
update public.players set next_rent_due = public.ny_today() + 28, next_phone_due = public.ny_today() + 28, next_car_due = public.ny_today() + 30
 where id = '00000000-0000-0000-0000-0000000000d1';
update public.players set next_rent_due = public.ny_today() + 3, next_phone_due = public.ny_today() + 3
 where id = '00000000-0000-0000-0000-0000000000d2';

\ir ../migrations/0054_weekly_due_dates.sql

select pg_temp.assert((select next_rent_due = public.ny_today() + 7 and next_phone_due = public.ny_today() + 7 and next_car_due = public.ny_today() + 7
  from public.players where id = '00000000-0000-0000-0000-0000000000d1'), 'month-ahead dates come back to a week');
select pg_temp.assert((select next_rent_due = public.ny_today() + 3 and next_phone_due = public.ny_today() + 3
  from public.players where id = '00000000-0000-0000-0000-0000000000d2'), 'nearer dates stay as they are');
select pg_temp.assert(not exists (select 1 from public.players where next_rent_due > public.ny_today() + 7), 'nobody pays rent more than a week out');

rollback;
\echo 'weekly_due_dates: ok'
