-- Scenario test for migration 0043 (whole outfits; fantasy ones need clout to buy).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000f1');
select pg_temp.assert(public.collector_value('fashion') = 1388, 'collector fashion keeps its value (outfits aside)');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
select 1 from public.create_player('outfit_buyer', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
reset role;
update public.players set bank_cash = 50000, clout = 999 where display_name = 'outfit_buyer';

select pg_temp.assert((public.shop_item('set-adventurer') ->> 'cloutReq')::int = 1000, 'Adventurer needs 1,000 clout');
select pg_temp.assert((public.shop_item('set-royalty') ->> 'cloutReq')::int = 25000, 'Royalty needs 25,000 clout');
select pg_temp.assert((public.shop_item('set-site-crew') ->> 'cloutReq')::int = 0, 'city outfits need no clout');
select pg_temp.assert(public.shop_item('set-site-crew') ->> 'slot' = 'outfit', 'outfits fill the outfit slot');
set role authenticated;

-- City outfits are sold for cash alone.
select 1 from public.buy_item('set-site-crew');
select pg_temp.assert(exists (select 1 from public.player_items where sku = 'set-site-crew'), 'city outfit bought');

-- 999 clout is short of the Adventurer; 1,000 opens it, and clout isn't spent (buying pays some).
reset role;
update public.players set clout = 999 where display_name = 'outfit_buyer';
set role authenticated;
select pg_temp.assert(pg_temp.raises($$select public.buy_item('set-adventurer')$$, 'outfit_needs_clout'), '999 clout cannot buy the Adventurer');
reset role;
update public.players set clout = 1000 where display_name = 'outfit_buyer';
set role authenticated;
select 1 from public.buy_item('set-adventurer');
select pg_temp.assert(exists (select 1 from public.player_items where sku = 'set-adventurer'), 'Adventurer bought at 1,000 clout');
select pg_temp.assert((select clout from public.players where display_name = 'outfit_buyer') >= 1000, 'clout is not spent');
select pg_temp.assert(pg_temp.raises($$select public.buy_item('set-tactical')$$, 'outfit_needs_clout'), 'Tactical still needs 2,500');

-- Wearing: an outfit and a top together are fine (different slots); two outfits are not.
select 1 from public.buy_item('fit-varsity-tee');
select 1 from public.save_look(array(select id from public.player_items where sku in ('set-site-crew', 'fit-varsity-tee')), 'none');
select pg_temp.assert(pg_temp.raises($$select public.save_look(array(select id from public.player_items where sku in ('set-site-crew', 'set-adventurer')), 'none')$$, 'one_per_slot'), 'one outfit at a time');

rollback;
\echo OUTFIT CHECKS PASSED
