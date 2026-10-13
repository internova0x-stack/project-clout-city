-- Scenario test for migration 0024 (pro gigs need clout; net worth on the player card).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000e1'), ('00000000-0000-0000-0000-0000000000e2');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
select 1 from public.create_player('gig_viewer', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select 1 from public.create_player('gig_worker', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select 1 from public.buy_item('fit-satin-bomber');
reset role;
update public.players set confidence = 90, energy = 100, clout = 499, bank_cash = 1000 where display_name = 'gig_worker';
insert into public.gig_offers (player_id, ny_date, tier, title, pay, energy, wait_minutes, confidence_req)
  select id, public.ny_today(), 'pro', 'Test pro gig', 1000, 10, 120, 50 from public.players where display_name = 'gig_worker';
insert into public.gig_offers (player_id, ny_date, tier, title, pay, energy, wait_minutes, confidence_req)
  select id, public.ny_today(), 'side', 'Test side gig', 400, 10, 60, 0 from public.players where display_name = 'gig_worker';
create temp table g as select id, title from public.gig_offers where title like 'Test % gig';
grant select on g to authenticated;
create temp table jacket as select value from public.player_items where sku = 'fit-satin-bomber'
  and player_id = '00000000-0000-0000-0000-0000000000e1';
grant select on jacket to authenticated;

set role authenticated;
select pg_temp.assert((public.city() #>> '{economy,gigs,pro,clout}')::int = 500 and (public.city() #>> '{economy,gigs,big,clout}')::int = 2000, 'thresholds in settings');
select pg_temp.assert(pg_temp.raises($$select public.accept_gig((select id from g where title = 'Test pro gig'))$$, 'needs_clout'), '499 clout is not enough for a pro gig');
reset role;
update public.players set clout = 500 where display_name = 'gig_worker';
set role authenticated;
select pg_temp.assert((public.accept_gig((select id from g where title = 'Test pro gig'))).accepted_at is not null, '500 clout and Confidence 50 take a pro gig');
reset role;
update public.players set clout = 0 where display_name = 'gig_worker';
update public.gig_offers set collected_at = now() where title = 'Test pro gig';
set role authenticated;
select pg_temp.assert((public.accept_gig((select id from g where title = 'Test side gig'))).accepted_at is not null, 'side gigs need no clout');

-- Net worth on the card: bank cash plus owned items, seen by another player.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
select pg_temp.assert((public.player_card('00000000-0000-0000-0000-0000000000e1') ->> 'netWorth')::int
                      = 1000 + (select value from jacket), 'net worth is bank plus items');

rollback;
\echo GIG CLOUT CHECKS PASSED
