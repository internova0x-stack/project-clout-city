-- Scenario test for migration 0112 (the rent alarm push): rent due within three days and not enough in the bank.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.q(p text) returns bigint language sql as $$
  select count(*) from public.push_queue where player_id = p::uuid and kind = 'rent_short' $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000112a1'), ('00000000-0000-0000-0000-0000000112a2'), ('00000000-0000-0000-0000-0000000112a3');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000112a1', false);
select 1 from public.create_player('Broke', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select public.push_subscribe('https://fcm.googleapis.com/fcm/send/112a', 'k', 'a', 'America/New_York');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000112a2', false);
select 1 from public.create_player('Flush', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select public.push_subscribe('https://fcm.googleapis.com/fcm/send/112b', 'k', 'a', 'America/New_York');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000112a3', false);
select 1 from public.create_player('Later', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select public.push_subscribe('https://fcm.googleapis.com/fcm/send/112c', 'k', 'a', 'America/New_York');
reset role;
update public.players set next_rent_due = public.ny_today() + 2, bank_cash = 200 where id = '00000000-0000-0000-0000-0000000112a1';
update public.players set next_rent_due = public.ny_today() + 2, bank_cash = 90000 where id = '00000000-0000-0000-0000-0000000112a2';
update public.players set next_rent_due = public.ny_today() + 6, bank_cash = 200 where id = '00000000-0000-0000-0000-0000000112a3';
delete from public.push_queue where player_id::text like '00000000-0000-0000-0000-0000000112a%';

select public.push_scan_rent_short();
select pg_temp.assert(pg_temp.q('00000000-0000-0000-0000-0000000112a1') = 1, 'short with rent in 2 days: one push');
select pg_temp.assert((select title from public.push_queue where player_id = '00000000-0000-0000-0000-0000000112a1' and kind = 'rent_short') = '💸 Rent''s due in 2 days and you''re short', 'copy');
select pg_temp.assert((select url from public.push_queue where player_id = '00000000-0000-0000-0000-0000000112a1' and kind = 'rent_short') = '/home?open=gigs', 'opens the Gigs app');
select pg_temp.assert(pg_temp.q('00000000-0000-0000-0000-0000000112a2') = 0, 'enough in the bank: nothing');
select pg_temp.assert(pg_temp.q('00000000-0000-0000-0000-0000000112a3') = 0, 'rent a week off: nothing yet');
select public.push_scan_rent_short();
select pg_temp.assert(pg_temp.q('00000000-0000-0000-0000-0000000112a1') = 1, 'once per rent date');

select 'rent_short: ok';
rollback;
