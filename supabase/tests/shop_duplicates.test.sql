-- Scenario test for migration 0108 (no product listed twice): the three older pieces that showed another item's
-- picture are retired, without a picture, logged, and still owned by whoever bought them.
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;

select pg_temp.assert((select count(*) = 3 from public.shop_catalog
                        where sku in ('lux-gold-chain', 'lux-designer-watch', 'fit-wide-trousers')
                          and status = 'retired' and images is null and source_image is null), 'the three duplicates are retired with no picture');
select pg_temp.assert((select count(distinct sku) = 3 from public.shop_audit where action = 'dedupe'), 'each is logged once');
select pg_temp.assert(not exists (select 1 from jsonb_array_elements(public.shop_catalog_public()) i
                                   where i ->> 'sku' in ('lux-gold-chain', 'lux-designer-watch', 'fit-wide-trousers')
                                     and i ->> 'status' = 'live'), 'players no longer see them on sale');
select pg_temp.assert((select status = 'live' from public.shop_catalog where sku = 'double-rope-chains') is not false, 'the newer item is untouched');

-- Running it again changes nothing and logs nothing new.
\i supabase/migrations/0108_shop_duplicates.sql
select pg_temp.assert((select count(*) = 3 from public.shop_audit where action = 'dedupe'), 'safe to run twice');

select 'shop_duplicates: ok';
rollback;
