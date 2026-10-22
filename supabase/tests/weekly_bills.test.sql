-- Scenario test for migration 0028 (weekly bills, re-tuned; a lower birth lottery).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000b2');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
select 1 from public.create_player('weekly', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']);
select public.roll_birth_lottery() as rolled \gset
select pg_temp.assert(:rolled between 1500 and 3000, 'the lottery rolls C$1,500 to C$3,000 (0113)');
select 1 from public.move_in('lic_highrise');
select pg_temp.assert((select bank_cash = :rolled - 1050 from public.players where id = auth.uid()), 'even the lowest roll covers a first week in the high-rise');

-- An owned car: insurance is 0.5% of its price, weekly.
reset role;
update public.players set bank_cash = 50000 where id = '00000000-0000-0000-0000-0000000000b2';
set role authenticated;
select 1 from public.buy_item('car-hatchback', 'buy');
select pg_temp.assert((select next_car_due = public.ny_today() + 7 from public.players where id = auth.uid()), 'insurance starts a week out');
reset role;
update public.players set next_car_due = public.ny_today(), next_rent_due = public.ny_today(), next_phone_due = public.ny_today() where id = '00000000-0000-0000-0000-0000000000b2';
set role authenticated;
select 1 from public.sync_player();
select pg_temp.assert((select amount = 105 from public.bills where kind = 'car_insurance'), 'hatchback insurance C$105 a week');
select pg_temp.assert((select amount = 1050 from public.bills where kind = 'rent'), 'high-rise rent C$1,050 a week');
select pg_temp.assert((select amount = 60 from public.bills where kind = 'phone'), 'phone C$60 a week');
select pg_temp.assert((select next_rent_due = public.ny_today() + 7 and next_phone_due = public.ny_today() + 7 and next_car_due = public.ny_today() + 7
  from public.players where id = auth.uid()), 'all three next week');

rollback;
\echo WEEKLY BILLS CHECKS PASSED
