-- Scenario test for migration 0102 (Clout Couture: numbered editions, real limits, refunds, the badge, a new drop).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.product(p_sku text) returns jsonb language sql as $$
  select p from jsonb_array_elements(public.store_catalog()) p where p ->> 'sku' = p_sku $$;
create function pg_temp.as_player(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000010' || n, false) $$;
create function pg_temp.refused(p_sku text, p_session text, p_code text) returns boolean language plpgsql as $$
begin
  perform public.start_purchase(p_sku, p_session);
  return false;
exception when sqlstate '22023' then return sqlerrm = p_code;
end $$;

insert into auth.users (id) select ('00000000-0000-0000-0000-00000000010' || n)::uuid from generate_series(1, 4) n;
insert into public.story_admins (user_id) values ('00000000-0000-0000-0000-000000000104');
set role authenticated;
do $$ begin
  for n in 1..4 loop
    perform pg_temp.as_player(n);
    perform public.create_player('Buyer' || n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']);
    perform public.roll_birth_lottery();
    perform public.move_in('astoria_studio');
  end loop;
end $$;
reset role;

-- A Couture sofa, two per drop, waiting for review: no checkout product yet.
insert into public.shop_catalog (sku, status, tab, slot, name, description, price, clout, stars, real_cash, price_usd_cents, edition_size,
                                 collection, origin, extra)
values ('cloud-nine-sofa', 'pending_review', 'home', 'living', 'Cloud Nine Sofa', 'A cloud you can sit on.', 0, 30, 4, true, 1499, 2,
        'Clout Couture', 'import', '{}');
select pg_temp.assert(not exists (select 1 from public.store_products where sku = 'cloud-nine-sofa'), 'no product before it goes on sale');
update public.shop_catalog set status = 'live', go_live_at = now() where sku = 'cloud-nine-sofa';
select pg_temp.assert((select product_type = 'collector_item' and price_cents = 1499 and active from public.store_products where sku = 'cloud-nine-sofa'),
                      'live: a $14.99 collector product');

-- ---- Two checkouts hold the whole drop ----
set role authenticated;
select pg_temp.as_player(1);
select pg_temp.assert((pg_temp.product('cloud-nine-sofa') -> 'edition') = '{"size": 2, "drop": 1, "dropEnd": 2, "issued": 0, "left": 2, "soldOut": false}', 'drop 1, two left');
select public.start_purchase('cloud-nine-sofa', 'cs_cn_1');
select pg_temp.as_player(2);
select public.start_purchase('cloud-nine-sofa', 'cs_cn_2');
select pg_temp.as_player(3);
select pg_temp.assert((pg_temp.product('cloud-nine-sofa') #>> '{edition,soldOut}')::boolean, 'both copies held: sold out');
select pg_temp.assert(pg_temp.refused('cloud-nine-sofa', 'cs_cn_3', 'sold_out'), 'a third checkout is refused');

-- ---- The webhook numbers each copy; an expired checkout frees its copy ----
reset role;
select pg_temp.assert(public.payment_grant('evt_cn_1', 'cs_cn_1', 'pi_cn_1', '00000000-0000-0000-0000-000000000101', 'cloud-nine-sofa', 1499, 'usd') = 'granted', 'first copy granted');
select pg_temp.assert(public.payment_expired('evt_cn_2x', 'cs_cn_2') = 'expired', 'second checkout abandoned');
select pg_temp.assert(exists (select 1 from public.player_items i join public.players p on p.id = i.player_id
                               where p.display_name = 'Buyer1' and i.sku = 'cloud-nine-sofa' and i.acquired = 'collector'), 'the sofa is in Possessions');
select pg_temp.assert(exists (select 1 from public.player_badges where player_id = '00000000-0000-0000-0000-000000000101' and badge_id = 'clout-couture'), 'Couture badge');
set role authenticated;
select pg_temp.as_player(1);
select pg_temp.assert((pg_temp.product('cloud-nine-sofa') ->> 'serial')::int = 1 and (pg_temp.product('cloud-nine-sofa') ->> 'owned')::boolean, 'No. 0001');
select pg_temp.assert(pg_temp.refused('cloud-nine-sofa', 'cs_cn_1b', 'already_owned'), 'one copy each');
select pg_temp.as_player(3);
select pg_temp.assert((pg_temp.product('cloud-nine-sofa') #>> '{edition,left}')::int = 1, 'one left again');
select public.start_purchase('cloud-nine-sofa', 'cs_cn_3');
reset role;
select pg_temp.assert(public.payment_grant('evt_cn_3', 'cs_cn_3', 'pi_cn_3', '00000000-0000-0000-0000-000000000103', 'cloud-nine-sofa', 1499, 'usd') = 'granted', 'second copy granted');
set role authenticated;
select pg_temp.as_player(3);
select pg_temp.assert((pg_temp.product('cloud-nine-sofa') ->> 'serial')::int = 2, 'No. 0002');

-- ---- A refund takes the piece and the badge back; its number is never issued again ----
reset role;
select pg_temp.assert(public.payment_refund('evt_cn_1r', 'pi_cn_1') = 'revoked', 'refund');
select pg_temp.assert(not exists (select 1 from public.player_items where player_id = '00000000-0000-0000-0000-000000000101' and sku = 'cloud-nine-sofa'), 'out of Possessions');
select pg_temp.assert(not exists (select 1 from public.player_badges where player_id = '00000000-0000-0000-0000-000000000101' and badge_id = 'clout-couture'), 'badge gone with the last piece');
select pg_temp.assert(exists (select 1 from public.player_badges where player_id = '00000000-0000-0000-0000-000000000103' and badge_id = 'clout-couture'), 'the other owner keeps theirs');
set role authenticated;
select pg_temp.as_player(2);
select pg_temp.assert((pg_temp.product('cloud-nine-sofa') #>> '{edition,soldOut}')::boolean, 'still sold out: No. 0001 is never reissued');
select pg_temp.assert(pg_temp.refused('cloud-nine-sofa', 'cs_cn_2b', 'sold_out'), 'refused while sold out');

-- ---- The Studio opens drop 2: numbering continues, Lola announces it ----
select pg_temp.as_player(1);
do $$ begin
  begin perform public.admin_couture_new_drop('cloud-nine-sofa'); raise exception 'FAIL: a player opened a drop';
  exception when insufficient_privilege or sqlstate '42501' then null; end;
end $$;
select pg_temp.as_player(4);
select pg_temp.assert(public.admin_couture_new_drop('cloud-nine-sofa', 3) = '{"size": 3, "drop": 2, "dropEnd": 5, "issued": 2, "left": 3, "soldOut": false}', 'drop 2: 0003 to 0005');
reset role;
select pg_temp.assert(exists (select 1 from public.news_items where id = 'couture-cloud-nine-sofa-drop-2' and status = 'approved' and body like '%0003 to 0005%'), 'News item for the drop');
set role authenticated;
do $$ begin
  begin perform public.admin_couture_new_drop('cloud-nine-sofa'); raise exception 'FAIL: a drop while copies are left';
  exception when sqlstate '22023' then null; end;
end $$;
select pg_temp.as_player(2);
select public.start_purchase('cloud-nine-sofa', 'cs_cn_2c');
reset role;
select pg_temp.assert(public.payment_grant('evt_cn_2c', 'cs_cn_2c', 'pi_cn_2c', '00000000-0000-0000-0000-000000000102', 'cloud-nine-sofa', 1499, 'usd') = 'granted', 'drop 2 copy');
set role authenticated;
select pg_temp.as_player(2);
select pg_temp.assert((pg_temp.product('cloud-nine-sofa') ->> 'serial')::int = 3, 'No. 0003, the first of drop 2');

-- ---- Off sale: no checkout ----
reset role;
update public.shop_catalog set status = 'retired' where sku = 'cloud-nine-sofa';
set role authenticated;
select pg_temp.as_player(4);
select pg_temp.assert(pg_temp.refused('cloud-nine-sofa', 'cs_cn_4', 'not_for_sale'), 'retired pieces are not sold');
select pg_temp.as_player(3);
select pg_temp.assert((pg_temp.product('cloud-nine-sofa') ->> 'serial')::int = 2, 'owners keep their number after it retires');

-- ---- The Velocity Veloce: your car, insured like the priciest C$ car; one car at a time; refunds empty the garage ----
reset role;
insert into public.shop_catalog (sku, status, tab, slot, name, price, clout, stars, real_cash, price_usd_cents, edition_size, collection, origin)
values ('velocity-veloce', 'live', 'cars', 'car', 'Velocity Veloce', 0, 420, 4, true, 4999, 100, 'Clout Couture', 'import');
select pg_temp.assert((select price from public.shop_catalog where sku = 'velocity-veloce')
                      = (select max(price) from public.shop_catalog where tab = 'cars' and not real_cash), 'priced (for insurance) like the priciest C$ car');
update public.players set car_sku = 'car-hatchback', car_mode = 'owned' where id = '00000000-0000-0000-0000-000000000103';
update public.players set car_sku = 'car-hatchback', car_mode = 'rented' where id = '00000000-0000-0000-0000-000000000104';
set role authenticated;
select pg_temp.as_player(3);
select pg_temp.assert(pg_temp.refused('velocity-veloce', 'cs_v_3', 'already_own_car'), 'one owned car at a time');
select pg_temp.as_player(4);
select public.start_purchase('velocity-veloce', 'cs_v_4');
reset role;
select pg_temp.assert(public.payment_grant('evt_v_4', 'cs_v_4', 'pi_v_4', '00000000-0000-0000-0000-000000000104', 'velocity-veloce', 4999, 'usd') = 'granted', 'Veloce granted');
select pg_temp.assert((select car_sku = 'velocity-veloce' and car_mode = 'owned' and next_car_due is not null from public.players
                        where id = '00000000-0000-0000-0000-000000000104'), 'it ends the rental and drives like an owned car');
select pg_temp.assert(public.payment_refund('evt_v_4r', 'pi_v_4') = 'revoked', 'Veloce refunded');
select pg_temp.assert((select car_sku is null and car_mode is null from public.players where id = '00000000-0000-0000-0000-000000000104'), 'out of the garage');

-- ---- Midas Shades: sold in Luxury, worn as fashion ----
reset role;
insert into public.shop_catalog (sku, status, tab, slot, name, price, clout, stars, real_cash, price_usd_cents, edition_size, collection, origin)
values ('midas-shades', 'live', 'luxury', 'face', 'Midas Shades', 0, 140, 4, true, 999, 100, 'Clout Couture', 'import');
select pg_temp.assert(public.shop_item('midas-shades') ->> 'category' = 'fashion', 'filed as fashion');
set role authenticated;
select pg_temp.as_player(3);
select public.start_purchase('midas-shades', 'cs_m_3');
reset role;
select pg_temp.assert(public.payment_grant('evt_m_3', 'cs_m_3', 'pi_m_3', '00000000-0000-0000-0000-000000000103', 'midas-shades', 999, 'usd') = 'granted', 'shades granted');
set role authenticated;
select pg_temp.as_player(3);
select 1 from public.equip_item((select id from public.player_items where player_id = auth.uid() and sku = 'midas-shades'), true);
select pg_temp.assert((select equipped from public.player_items where player_id = auth.uid() and sku = 'midas-shades'), 'worn');
reset role;
select pg_temp.assert((select value from public.player_items where sku = 'midas-shades') = public.collector_value('luxury')
                      and public.collector_value('luxury') <> public.collector_value('fashion'), 'valued as Luxury, its Shop tab');

reset role;
rollback;
\echo couture: ok
