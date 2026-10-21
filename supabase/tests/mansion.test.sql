-- Scenario test for migration 0105 (the Waterfront Mansion: plots, Lola's news, living there, upkeep, refunds).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.as_player(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000030' || n, false) $$;
create function pg_temp.code(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return 'ok'; exception when others then return sqlerrm; end $$;

insert into auth.users (id) select ('00000000-0000-0000-0000-00000000030' || n)::uuid from generate_series(1, 3) n;
set role authenticated;
do $$ begin
  for n in 1..3 loop
    perform pg_temp.as_player(n);
    perform public.create_player('Baron' || n, 'bodega_drip', '{}', null, true);
    perform public.set_traits(array['loud', 'hustler']);
    perform public.roll_birth_lottery();
    perform public.move_in('astoria_share');
  end loop;
end $$;
reset role;
update public.players set bank_cash = 50000 where display_name like 'Baron%';
insert into public.shop_catalog (sku, status, tab, slot, name, price, clout, stars, real_cash, price_usd_cents, edition_size, collection, origin, wearable)
values ('waterfront-mansion', 'live', 'houses', 'plot', 'The Waterfront Mansion', 0, 900, 4, true, 9999, 10, 'Clout Couture', 'import', true);

-- ---- Two owners take plots 1 and 2; Lola announces them ----
set role authenticated;
select pg_temp.as_player(1);
select public.start_purchase('waterfront-mansion', 'cs_m_1');
select pg_temp.as_player(2);
select public.start_purchase('waterfront-mansion', 'cs_m_2');
reset role;
select public.payment_grant('evt_m_1', 'cs_m_1', 'pi_m_1', '00000000-0000-0000-0000-000000000301', 'waterfront-mansion', 9999, 'usd');
select public.payment_grant('evt_m_2', 'cs_m_2', 'pi_m_2', '00000000-0000-0000-0000-000000000302', 'waterfront-mansion', 9999, 'usd');
select pg_temp.assert((select array_agg(plot order by plot) from public.mansion_plots) = array[1, 2], 'plots 1 and 2');
select pg_temp.assert((select count(*) from public.news_items where id like 'mansion-%' and body like '%Billionaire''s Row%') = 2, 'Lola announces each owner');
set role authenticated;
select pg_temp.as_player(3);
select pg_temp.assert((public.couture_map() #>> '{mansions,1,name}') = 'Baron2' and (public.couture_map() #>> '{mansions,1,plot}')::int = 2, 'the map: plot and gate name');
reset role;
select pg_temp.assert((public.couture_edition('waterfront-mansion') ->> 'left')::int = 8, 'eight plots left');
set role authenticated;
select pg_temp.as_player(3);

-- ---- Owners only; moving in costs one week of upkeep; tick bills the upkeep ----
select pg_temp.assert(pg_temp.code($$select public.move_home('waterfront_mansion')$$) = 'owners_only', 'not for non-owners');
select pg_temp.as_player(1);
create temp table cash as select bank_cash from public.players where display_name = 'Baron1';
select pg_temp.assert(((public.move_home('waterfront_mansion')) ->> 'cash')::int = -1750, 'the first week, no broker');
select pg_temp.assert((select home_id = 'waterfront_mansion' from public.players where display_name = 'Baron1'), 'moved in');
select pg_temp.assert((select myplot from (select (public.couture_map() ->> 'myPlot')::int as myplot) x) = 1, 'my plot');
reset role;
select pg_temp.assert(public.rent_for('waterfront_mansion') = 1750, 'upkeep = the priciest Astoria rent');
select pg_temp.assert(public.cheapest_home() = 'astoria_share', 'never an eviction target');

-- ---- A refund frees the plot and moves them out; the next buyer gets plot 1 back ----
select public.payment_refund('evt_m_1r', 'pi_m_1');
select pg_temp.assert(not exists (select 1 from public.mansion_plots where plot = 1), 'plot 1 freed');
select pg_temp.assert((select home_id = 'astoria_share' from public.players where display_name = 'Baron1'), 'moved to the cheapest home');
select pg_temp.assert((public.couture_edition('waterfront-mansion') ->> 'left')::int = 9, 'a refund frees a plot for sale');
set role authenticated;
select pg_temp.as_player(3);
select public.start_purchase('waterfront-mansion', 'cs_m_3');
reset role;
select public.payment_grant('evt_m_3', 'cs_m_3', 'pi_m_3', '00000000-0000-0000-0000-000000000303', 'waterfront-mansion', 9999, 'usd');
select pg_temp.assert((select plot from public.mansion_plots where player_id = '00000000-0000-0000-0000-000000000303') = 1, 'the lowest free plot');
select pg_temp.assert((select edition_no from public.entitlements where player_id = '00000000-0000-0000-0000-000000000303' and sku = 'waterfront-mansion') = 3, 'a new edition number, never No. 0001 again');
do $$ begin
  set local role authenticated;
  begin perform 1 from public.mansion_plots; raise exception 'FAIL: players read plots directly';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
rollback;
\echo mansion: ok
