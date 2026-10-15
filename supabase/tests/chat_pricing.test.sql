-- Scenario test for migration 0051 (unlimited chat: monthly $4.99, yearly $39.99, forever $119.99).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;
create function pg_temp.raises(stmt text, err text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then if sqlerrm like '%' || err || '%' then return true; end if; raise; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000f1');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
select 1 from public.create_player('price_one', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');

-- Three plans in the catalog, at the new prices.
create temp table passes as select x from jsonb_array_elements(public.store_catalog()) x where x ->> 'type' = 'chat_pass';
grant all on passes to authenticated;
select pg_temp.assert((select count(*) from passes) = 3, 'monthly, yearly and forever');
select pg_temp.assert((select (x ->> 'priceCents')::int from passes where x ->> 'sku' = 'chat-unlimited-monthly') = 499, '$4.99 a month');
select pg_temp.assert((select (x ->> 'priceCents')::int from passes where x ->> 'sku' = 'chat-unlimited-yearly') = 3999, '$39.99 a year');
select pg_temp.assert((select (x ->> 'priceCents')::int from passes where x ->> 'sku' = 'chat-unlimited-forever') = 11999, '$119.99 forever');
reset role;
select pg_temp.assert((select recurring from public.store_products where sku = 'chat-unlimited-yearly') = 'year', 'yearly is a subscription');
select pg_temp.assert((select recurring from public.store_products where sku = 'chat-unlimited-forever') is null, 'forever is one payment');

-- The yearly pass lifts the limit and follows its subscription.
select public.payment_grant('evt_y1', 'cs_y1', 'sub_year', '00000000-0000-0000-0000-0000000000f1', 'chat-unlimited-yearly', 3999, 'usd');
set role authenticated;
select pg_temp.assert((public.chat_status() ->> 'unlimited')::boolean, 'unlimited with the yearly pass');
select pg_temp.assert(pg_temp.raises($$select public.start_purchase('chat-unlimited-forever', 'cs_two')$$, 'already_owned'), 'no second pass on top');
reset role;
select pg_temp.assert(public.payment_subscription('evt_y2', 'sub_year', 'canceled') = 'revoked', 'a cancelled year ends it');
set role authenticated;
select pg_temp.assert(not (public.chat_status() ->> 'unlimited')::boolean, 'the limit comes back');
select 1 from public.start_purchase('chat-unlimited-forever', 'cs_forever');

rollback;
\echo 'chat_pricing: ok'
