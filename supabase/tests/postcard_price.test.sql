-- Scenario test for migration 0086: every postcard is $1.99.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
select pg_temp.assert((select count(*) > 0 and bool_and(price_cents = 199) from public.store_products where product_type = 'postcard'), 'postcards are $1.99');
rollback;
\echo 'postcard_price: ok'
