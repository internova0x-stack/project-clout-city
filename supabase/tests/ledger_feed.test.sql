-- Scenario test for migration 0023 (the Bank's history names where and what; event copy).
-- Runs in a transaction and rolls back. Run with scripts/test-db.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000d1'), ('00000000-0000-0000-0000-0000000000d2');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', false);
select 1 from public.create_player('feed_other', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select 1 from public.create_player('feed_me', 'bodega_drip', '{}', null, true);
select 1 from public.set_traits(array['loud', 'hustler']); select 1 from public.roll_birth_lottery(); select 1 from public.move_in('astoria_studio');
select 1 from public.buy_item('fit-satin-bomber');

create temp table f as select public.ledger_feed() as feed;
select pg_temp.assert((select feed -> 0 ->> 'kind' from f) = 'purchase', 'newest first');
select pg_temp.assert((select feed -> 0 ->> 'sku' from f) = 'fit-satin-bomber', 'a purchase names its item');
select pg_temp.assert((select bool_and(e ->> 'kind' <> 'x') and count(*) >= 3 from f, jsonb_array_elements(feed) e), 'lottery, rent and the buy');
select pg_temp.assert(not exists (select 1 from f, jsonb_array_elements(feed) e where (e ->> 'amount')::int = 0), 'cash rows only');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', false);
select pg_temp.assert(not exists (select 1 from jsonb_array_elements(public.ledger_feed()) e where e ->> 'kind' = 'purchase'), 'only your own rows');
select pg_temp.assert((select blurb not ilike '%forty%' from public.exclusive_events where id = 'jada-sol-listening'), 'no promised crowd size');

rollback;
\echo LEDGER FEED CHECKS PASSED
